import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { queryAll, queryOne, run } from '../db.js'

const router = Router()

router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const donors = queryAll('SELECT * FROM donors ORDER BY created_at DESC')
    res.json({ success: true, data: donors })
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) })
  }
})

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, blood_type, phone, gender, birth_date, donation_count } = req.body
    if (!name || !blood_type || !phone || !gender || !birth_date) {
      res.status(400).json({ success: false, error: '缺少必填字段' })
      return
    }
    const id = uuidv4()
    const now = new Date().toISOString()
    run(
      `INSERT INTO donors (id, name, blood_type, phone, gender, birth_date, donation_count, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name, blood_type, phone, gender, birth_date, donation_count ?? 0, now]
    )
    const donor = queryOne('SELECT * FROM donors WHERE id = ?', [id])
    res.status(201).json({ success: true, data: donor })
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) })
  }
})

router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const existing = queryOne('SELECT * FROM donors WHERE id = ?', [id])
    if (!existing) {
      res.status(404).json({ success: false, error: '献血者不存在' })
      return
    }
    const { name, blood_type, phone, gender, birth_date, donation_count } = req.body
    const row = queryOne('SELECT * FROM donors WHERE id = ?', [id]) as Record<string, unknown>
    run(
      `UPDATE donors SET name=?, blood_type=?, phone=?, gender=?, birth_date=?, donation_count=? WHERE id=?`,
      [
        name ?? row.name,
        blood_type ?? row.blood_type,
        phone ?? row.phone,
        gender ?? row.gender,
        birth_date ?? row.birth_date,
        donation_count ?? row.donation_count,
        id,
      ]
    )
    const updated = queryOne('SELECT * FROM donors WHERE id = ?', [id])
    res.json({ success: true, data: updated })
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) })
  }
})

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const donor = queryOne('SELECT * FROM donors WHERE id = ?', [req.params.id])
    if (!donor) {
      res.status(404).json({ success: false, error: '献血者不存在' })
      return
    }
    res.json({ success: true, data: donor })
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) })
  }
})

export default router
