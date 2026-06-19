import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { queryAll, queryOne, queryVal, run } from '../db.js'

const router = Router()

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { month } = req.query
    let sql = `SELECT s.*, d.name as donor_name, d.blood_type as blood_type 
               FROM slots s LEFT JOIN donors d ON s.donor_id = d.id`
    const params: unknown[] = []
    if (month) {
      sql += ' WHERE s.date LIKE ?'
      params.push(`${month}%`)
    }
    sql += ' ORDER BY s.date, s.time_start'
    const slots = queryAll(sql, params)
    res.json({ success: true, data: slots })
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) })
  }
})

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { donor_id, date, time_start, time_end, status } = req.body
    if (!date || !time_start || !time_end) {
      res.status(400).json({ success: false, error: '缺少必填字段' })
      return
    }
    const id = uuidv4()
    const now = new Date().toISOString()
    run(
      `INSERT INTO slots (id, donor_id, date, time_start, time_end, status, no_show_reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, donor_id ?? null, date, time_start, time_end, status ?? 'available', null, now]
    )
    const slot = queryOne('SELECT * FROM slots WHERE id = ?', [id])
    res.status(201).json({ success: true, data: slot })
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) })
  }
})

router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const existing = queryOne('SELECT * FROM slots WHERE id = ?', [id]) as Record<string, unknown> | null
    if (!existing) {
      res.status(404).json({ success: false, error: '预约槽位不存在' })
      return
    }
    const { donor_id, date, time_start, time_end, status, no_show_reason } = req.body

    const oldStatus = existing.status as string
    const newStatus = status ?? oldStatus
    const newDate = date ?? (existing.date as string)

    let impactAssessment: Record<string, unknown> | null = null

    if (oldStatus === 'booked' && (newStatus === 'no_show' || newStatus === 'cancelled')) {
      impactAssessment = assessQuotaImpact(newDate, existing.donor_id as string)
    }

    if (oldStatus === 'booked' && newStatus === 'no_show') {
      if (!no_show_reason) {
        res.status(400).json({ success: false, error: '标记爽约必须填写原因' })
        return
      }
    }

    run(
      `UPDATE slots SET donor_id=?, date=?, time_start=?, time_end=?, status=?, no_show_reason=? WHERE id=?`,
      [
        donor_id !== undefined ? donor_id : existing.donor_id,
        newDate,
        time_start ?? existing.time_start,
        time_end ?? existing.time_end,
        newStatus,
        newStatus === 'no_show' ? (no_show_reason ?? null) : (newStatus === 'cancelled' ? null : (no_show_reason ?? existing.no_show_reason)),
        id,
      ]
    )

    const updated = queryOne('SELECT * FROM slots WHERE id = ?', [id])
    res.json({ success: true, data: updated, impact: impactAssessment })
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) })
  }
})

router.get('/quota-impact', async (req: Request, res: Response): Promise<void> => {
  try {
    const { date } = req.query
    if (!date) {
      res.status(400).json({ success: false, error: '缺少日期参数' })
      return
    }
    const impact = assessQuotaImpact(date as string, null)
    res.json({ success: true, data: impact })
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) })
  }
})

router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const existing = queryOne('SELECT * FROM slots WHERE id = ?', [id])
    if (!existing) {
      res.status(404).json({ success: false, error: '预约槽位不存在' })
      return
    }
    run('DELETE FROM slots WHERE id = ?', [id])
    res.json({ success: true, data: null })
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) })
  }
})

function assessQuotaImpact(date: string, donorId: string | null): Record<string, unknown> {
  const DAILY_QUOTA = 8
  const SEPARATION_CAPACITY = 6

  const totalSlots = (queryVal(
    `SELECT COUNT(*) as c FROM slots WHERE date = ? AND status != 'cancelled'`,
    [date]
  ) || 0) as number

  const bookedSlots = (queryVal(
    `SELECT COUNT(*) as c FROM slots WHERE date = ? AND status = 'booked'`,
    [date]
  ) || 0) as number

  const completedSlots = (queryVal(
    `SELECT COUNT(*) as c FROM slots WHERE date = ? AND status = 'completed'`,
    [date]
  ) || 0) as number

  const noShowSlots = (queryVal(
    `SELECT COUNT(*) as c FROM slots WHERE date = ? AND status = 'no_show'`,
    [date]
  ) || 0) as number

  const availableSlots = (queryVal(
    `SELECT COUNT(*) as c FROM slots WHERE date = ? AND status = 'available'`,
    [date]
  ) || 0) as number

  const effectiveSlots = bookedSlots + completedSlots
  const quotaDeficit = DAILY_QUOTA - effectiveSlots
  const separationLoad = completedSlots
  const separationRemaining = SEPARATION_CAPACITY - separationLoad

  let donorBloodType: string | null = null
  if (donorId) {
    const donor = queryOne('SELECT blood_type FROM donors WHERE id = ?', [donorId]) as Record<string, unknown> | null
    donorBloodType = donor ? (donor.blood_type as string) : null
  }

  const bloodTypeDistribution = queryAll<{ blood_type: string; cnt: number }>(
    `SELECT d.blood_type, COUNT(*) as cnt FROM slots s JOIN donors d ON s.donor_id = d.id 
     WHERE s.date = ? AND s.status IN ('booked', 'completed') GROUP BY d.blood_type`,
    [date]
  )

  const affectedBloodDeficit = donorBloodType
    ? quotaDeficit > 0
      ? bloodTypeDistribution.find(b => b.blood_type === donorBloodType)
        ? 0
        : 1
      : 0
    : 0

  return {
    date,
    daily_quota: DAILY_QUOTA,
    separation_capacity: SEPARATION_CAPACITY,
    total_slots: totalSlots,
    booked_slots: bookedSlots,
    completed_slots: completedSlots,
    no_show_slots: noShowSlots,
    available_slots: availableSlots,
    effective_collection: effectiveSlots,
    quota_deficit: Math.max(0, quotaDeficit),
    quota_at_risk: quotaDeficit > 0,
    separation_load: separationLoad,
    separation_remaining: Math.max(0, separationRemaining),
    separation_overloaded: separationLoad >= SEPARATION_CAPACITY,
    donor_blood_type: donorBloodType,
    affected_blood_deficit: affectedBloodDeficit,
    blood_type_distribution: bloodTypeDistribution,
  }
}

export default router
