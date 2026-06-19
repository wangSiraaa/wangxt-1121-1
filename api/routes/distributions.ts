import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { queryAll, queryOne, run } from '../db.js'

const router = Router()

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { inventory_id, request_id, operator } = req.body
    if (!inventory_id || !request_id || !operator) {
      res.status(400).json({ success: false, error: '缺少必填字段' })
      return
    }

    const inv = queryOne('SELECT * FROM inventory WHERE id = ?', [inventory_id]) as Record<string, unknown> | null
    if (!inv) {
      res.status(400).json({ success: false, error: '库存记录不存在' })
      return
    }
    if (inv.status !== 'available') {
      res.status(400).json({ success: false, error: '库存状态不是可用，无法分发' })
      return
    }

    const request = queryOne('SELECT * FROM hospital_requests WHERE id = ?', [request_id]) as Record<string, unknown> | null
    if (!request) {
      res.status(400).json({ success: false, error: '医院请求不存在' })
      return
    }

    if (inv.blood_type !== request.blood_type) {
      res.status(400).json({ success: false, error: '库存血型与请求血型不匹配' })
      return
    }

    const now = Date.now()
    const expiryMs = new Date(inv.expiry_time as string).getTime()
    const remainingHours = (expiryMs - now) / 3600000
    const distance = request.distance_km as number

    let minHours = 12
    if (distance > 100) {
      minHours = 48
    } else if (distance > 50) {
      minHours = 24
    }

    if (remainingHours < minHours) {
      res.status(400).json({
        success: false,
        error: `剩余保质期不足：距离${distance}km需要至少${minHours}小时，当前剩余${remainingHours.toFixed(1)}小时`,
      })
      return
    }

    const id = uuidv4()
    const distributedAt = new Date().toISOString()
    run(
      `INSERT INTO distributions (id, inventory_id, request_id, hospital_name, distributed_at, operator) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, inventory_id, request_id, request.hospital_name, distributedAt, operator]
    )

    run(`UPDATE inventory SET status = 'distributed', blood_type_locked = 1 WHERE id = ?`, [inventory_id])
    run(`UPDATE hospital_requests SET status = 'fulfilled' WHERE id = ?`, [request_id])

    const dist = queryOne('SELECT * FROM distributions WHERE id = ?', [id])
    res.status(201).json({ success: true, data: dist })
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) })
  }
})

router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const distributions = queryAll('SELECT * FROM distributions ORDER BY distributed_at DESC')
    res.json({ success: true, data: distributions })
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) })
  }
})

export default router
