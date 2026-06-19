import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { queryAll, queryOne, run } from '../db.js'

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
      `INSERT INTO slots (id, donor_id, date, time_start, time_end, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, donor_id ?? null, date, time_start, time_end, status ?? 'available', now]
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
    const existing = queryOne('SELECT * FROM slots WHERE id = ?', [id])
    if (!existing) {
      res.status(404).json({ success: false, error: '预约槽位不存在' })
      return
    }
    const { donor_id, date, time_start, time_end, status } = req.body
    const row = existing as Record<string, unknown>
    run(
      `UPDATE slots SET donor_id=?, date=?, time_start=?, time_end=?, status=? WHERE id=?`,
      [
        donor_id !== undefined ? donor_id : row.donor_id,
        date ?? row.date,
        time_start ?? row.time_start,
        time_end ?? row.time_end,
        status ?? row.status,
        id,
      ]
    )
    const updated = queryOne('SELECT * FROM slots WHERE id = ?', [id])
    res.json({ success: true, data: updated })
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

export default router
