import { Router, type Request, type Response } from 'express'
import { queryAll, queryOne, run } from '../db.js'

const router = Router()

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, blood_type } = req.query
    let sql = `SELECT i.*, d.name as donor_name 
               FROM inventory i LEFT JOIN donors d ON i.donor_id = d.id`
    const conditions: string[] = []
    const params: unknown[] = []
    if (status) {
      conditions.push('i.status = ?')
      params.push(status)
    }
    if (blood_type) {
      conditions.push('i.blood_type = ?')
      params.push(blood_type)
    }
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ')
    }
    sql += ' ORDER BY i.created_at DESC'
    const items = queryAll(sql, params)
    res.json({ success: true, data: items })
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) })
  }
})

router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const existing = queryOne('SELECT * FROM inventory WHERE id = ?', [id]) as Record<string, unknown> | null
    if (!existing) {
      res.status(404).json({ success: false, error: '库存记录不存在' })
      return
    }

    const { blood_type, status, volume_ml } = req.body

    if (blood_type && blood_type !== existing.blood_type) {
      if (existing.blood_type_locked || existing.status === 'distributed') {
        res.status(400).json({ success: false, error: '血型已锁定或已分发，无法更改' })
        return
      }
    }

    const row = existing
    run(
      `UPDATE inventory SET blood_type=?, status=?, volume_ml=? WHERE id=?`,
      [
        blood_type ?? row.blood_type,
        status ?? row.status,
        volume_ml ?? row.volume_ml,
        id,
      ]
    )
    const updated = queryOne('SELECT * FROM inventory WHERE id = ?', [id])
    res.json({ success: true, data: updated })
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) })
  }
})

export default router
