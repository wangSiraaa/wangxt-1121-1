import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { queryAll, queryOne, run } from '../db.js'

const router = Router()

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { result } = req.query
    let sql = `SELECT s.*, d.name as donor_name, d.blood_type as blood_type 
               FROM screenings s LEFT JOIN donors d ON s.donor_id = d.id`
    const params: unknown[] = []
    if (result) {
      sql += ' WHERE s.result = ?'
      params.push(result)
    }
    sql += ' ORDER BY s.screened_at DESC'
    const screenings = queryAll(sql, params)
    res.json({ success: true, data: screenings })
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) })
  }
})

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { appointment_id, donor_id, hbsag, hcv, hiv, syphilis, alt_value, result, screener } = req.body
    if (!appointment_id || !donor_id || !result || !screener) {
      res.status(400).json({ success: false, error: '缺少必填字段' })
      return
    }

    const slot = queryOne('SELECT * FROM slots WHERE id = ?', [appointment_id]) as Record<string, unknown> | null
    if (!slot) {
      res.status(400).json({ success: false, error: '预约槽位不存在' })
      return
    }
    if (slot.status !== 'booked') {
      res.status(400).json({ success: false, error: '只能对已预约的槽位进行筛查' })
      return
    }

    const id = uuidv4()
    const now = new Date().toISOString()
    const batchNo = `PLT-${now.slice(0, 10).replace(/-/g, '')}-${String(Math.floor(Math.random() * 999) + 1).padStart(3, '0')}`

    run(
      `INSERT INTO screenings (id, appointment_id, donor_id, hbsag, hcv, hiv, syphilis, alt_value, result, screened_at, screener, is_retest, original_screening_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, appointment_id, donor_id, hbsag ?? 'negative', hcv ?? 'negative', hiv ?? 'negative', syphilis ?? 'negative', alt_value ?? 0, result, now, screener, 0, null]
    )

    run(`UPDATE slots SET status = 'completed' WHERE id = ?`, [appointment_id])

    if (result === 'passed') {
      const donor = queryOne('SELECT * FROM donors WHERE id = ?', [donor_id]) as Record<string, unknown>
      const invId = uuidv4()
      const collTime = now
      const expTime = new Date(Date.now() + 5 * 86400000).toISOString()
      run(
        `INSERT INTO inventory (id, screening_id, donor_id, blood_type, batch_no, collection_time, expiry_time, volume_ml, status, blood_type_locked, removal_reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [invId, id, donor_id, donor.blood_type, batchNo, collTime, expTime, 250, 'available', 0, null, now]
      )
    }

    const screening = queryOne(
      `SELECT s.*, d.name as donor_name, d.blood_type as blood_type 
       FROM screenings s LEFT JOIN donors d ON s.donor_id = d.id 
       WHERE s.id = ?`,
      [id]
    )
    res.status(201).json({ success: true, data: screening })
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) })
  }
})

router.post('/retest', async (req: Request, res: Response): Promise<void> => {
  try {
    const { original_screening_id, hbsag, hcv, hiv, syphilis, alt_value, result, screener, retest_reason } = req.body
    if (!original_screening_id || !result || !screener) {
      res.status(400).json({ success: false, error: '缺少必填字段' })
      return
    }

    const original = queryOne('SELECT * FROM screenings WHERE id = ?', [original_screening_id]) as Record<string, unknown> | null
    if (!original) {
      res.status(404).json({ success: false, error: '原筛查记录不存在' })
      return
    }

    const id = uuidv4()
    const now = new Date().toISOString()

    run(
      `INSERT INTO screenings (id, appointment_id, donor_id, hbsag, hcv, hiv, syphilis, alt_value, result, screened_at, screener, is_retest, original_screening_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, original.appointment_id, original.donor_id, hbsag ?? 'negative', hcv ?? 'negative', hiv ?? 'negative', syphilis ?? 'negative', alt_value ?? 0, result, now, screener, 1, original_screening_id]
    )

    let removedInventory: Record<string, unknown>[] = []

    if (result === 'failed') {
      const relatedInventory = queryAll<Record<string, unknown>>(
        `SELECT * FROM inventory WHERE screening_id = ? AND status = 'available'`,
        [original_screening_id]
      )

      const positiveItems: string[] = []
      if (hbsag === 'positive') positiveItems.push('HBsAg')
      if (hcv === 'positive') positiveItems.push('HCV')
      if (hiv === 'positive') positiveItems.push('HIV')
      if (syphilis === 'positive') positiveItems.push('梅毒')
      const altNote = alt_value && Number(alt_value) > 40 ? `ALT>${alt_value}` : ''
      if (altNote) positiveItems.push(altNote)
      const reason = `复检阳性: ${positiveItems.join('、')}${retest_reason ? '；' + retest_reason : ''}`

      for (const inv of relatedInventory) {
        run(
          `UPDATE inventory SET status = 'retest_failed', blood_type_locked = 1, removal_reason = ? WHERE id = ?`,
          [reason, inv.id]
        )
        removedInventory.push({ ...inv, status: 'retest_failed', removal_reason: reason })
      }
    }

    const screening = queryOne(
      `SELECT s.*, d.name as donor_name, d.blood_type as blood_type 
       FROM screenings s LEFT JOIN donors d ON s.donor_id = d.id 
       WHERE s.id = ?`,
      [id]
    )
    res.status(201).json({ success: true, data: { ...screening, removed_bags: removedInventory.length }, removed_inventory: removedInventory })
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) })
  }
})

export default router
