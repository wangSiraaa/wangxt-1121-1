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
    run(
      `INSERT INTO screenings (id, appointment_id, donor_id, hbsag, hcv, hiv, syphilis, alt_value, result, screened_at, screener) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, appointment_id, donor_id, hbsag ?? 'negative', hcv ?? 'negative', hiv ?? 'negative', syphilis ?? 'negative', alt_value ?? 0, result, now, screener]
    )

    run(`UPDATE slots SET status = 'completed' WHERE id = ?`, [appointment_id])

    if (result === 'passed') {
      const donor = queryOne('SELECT * FROM donors WHERE id = ?', [donor_id]) as Record<string, unknown>
      const invId = uuidv4()
      const collTime = now
      const expTime = new Date(Date.now() + 5 * 86400000).toISOString()
      run(
        `INSERT INTO inventory (id, screening_id, donor_id, blood_type, collection_time, expiry_time, volume_ml, status, blood_type_locked, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [invId, id, donor_id, donor.blood_type, collTime, expTime, 250, 'available', 0, now]
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

export default router
