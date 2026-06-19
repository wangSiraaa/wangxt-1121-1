import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { queryAll, queryOne, run } from '../db.js'

const router = Router()

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { status } = req.query
    let sql = 'SELECT * FROM hospital_requests'
    const params: unknown[] = []
    if (status) {
      sql += ' WHERE status = ?'
      params.push(status)
    }
    sql += ' ORDER BY created_at DESC'
    const requests = queryAll(sql, params)
    res.json({ success: true, data: requests })
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) })
  }
})

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { hospital_name, distance_km, hospital_level, transport_hours, blood_type, quantity, urgency } = req.body
    if (!hospital_name || !distance_km || !blood_type || !quantity) {
      res.status(400).json({ success: false, error: '缺少必填字段' })
      return
    }
    const id = uuidv4()
    const now = new Date().toISOString()
    run(
      `INSERT INTO hospital_requests (id, hospital_name, distance_km, hospital_level, transport_hours, blood_type, quantity, urgency, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, hospital_name, distance_km, hospital_level ?? 'secondary', transport_hours ?? 0, blood_type, quantity, urgency ?? 'routine', 'pending', now]
    )
    const request = queryOne('SELECT * FROM hospital_requests WHERE id = ?', [id])
    res.status(201).json({ success: true, data: request })
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) })
  }
})

router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const existing = queryOne('SELECT * FROM hospital_requests WHERE id = ?', [id])
    if (!existing) {
      res.status(404).json({ success: false, error: '医院请求不存在' })
      return
    }
    const { hospital_name, distance_km, hospital_level, transport_hours, blood_type, quantity, urgency, status } = req.body
    const row = existing as Record<string, unknown>
    run(
      `UPDATE hospital_requests SET hospital_name=?, distance_km=?, hospital_level=?, transport_hours=?, blood_type=?, quantity=?, urgency=?, status=? WHERE id=?`,
      [
        hospital_name ?? row.hospital_name,
        distance_km ?? row.distance_km,
        hospital_level ?? row.hospital_level,
        transport_hours ?? row.transport_hours,
        blood_type ?? row.blood_type,
        quantity ?? row.quantity,
        urgency ?? row.urgency,
        status ?? row.status,
        id,
      ]
    )
    const updated = queryOne('SELECT * FROM hospital_requests WHERE id = ?', [id])
    res.json({ success: true, data: updated })
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) })
  }
})

export default router
