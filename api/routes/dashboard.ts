import { Router, type Request, type Response } from 'express'
import { queryAll, queryVal } from '../db.js'

const router = Router()

router.get('/stats', async (_req: Request, res: Response): Promise<void> => {
  try {
    const today = new Date().toISOString().split('T')[0]

    const collectionCount = (queryVal(
      `SELECT COUNT(*) as c FROM inventory WHERE DATE(collection_time) = ?`,
      [today]
    ) || 0) as number

    const availableCount = (queryVal(
      `SELECT COUNT(*) as c FROM inventory WHERE status = 'available'`
    ) || 0) as number

    const pendingCount = (queryVal(
      `SELECT COUNT(*) as c FROM hospital_requests WHERE status = 'pending'`
    ) || 0) as number

    const expiringSoon = new Date(Date.now() + 24 * 3600000).toISOString()
    const expiringCount = (queryVal(
      `SELECT COUNT(*) as c FROM inventory WHERE status = 'available' AND expiry_time <= ?`,
      [expiringSoon]
    ) || 0) as number

    res.json({
      success: true,
      data: {
        today_collection: collectionCount,
        available_inventory: availableCount,
        pending_requests: pendingCount,
        expiring_soon: expiringCount,
      },
    })
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) })
  }
})

router.get('/todos', async (_req: Request, res: Response): Promise<void> => {
  try {
    const pendingScreenings = queryAll(
      `SELECT s.id as slot_id, s.donor_id, d.name as donor_name, d.blood_type, s.date, s.time_start, s.time_end
       FROM slots s LEFT JOIN donors d ON s.donor_id = d.id
       WHERE s.status = 'booked' ORDER BY s.date, s.time_start`
    )

    const expiringSoon = new Date(Date.now() + 24 * 3600000).toISOString()
    const expiringInventory = queryAll(
      `SELECT i.id, d.name as donor_name, i.blood_type, i.expiry_time,
       CAST((julianday(i.expiry_time) - julianday('now')) * 24 AS INTEGER) as hours_left
       FROM inventory i LEFT JOIN donors d ON i.donor_id = d.id
       WHERE i.status = 'available' AND i.expiry_time <= ? ORDER BY i.expiry_time ASC`,
      [expiringSoon]
    )

    const pendingRequests = queryAll(
      `SELECT * FROM hospital_requests WHERE status = 'pending' ORDER BY created_at ASC`
    )

    res.json({
      success: true,
      data: {
        pending_screenings: pendingScreenings,
        expiring_inventory: expiringInventory,
        pending_requests: pendingRequests,
      },
    })
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) })
  }
})

export default router
