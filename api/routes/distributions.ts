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
    const hospitalLevel = (request.hospital_level as string) || 'secondary'
    const transportHours = (request.transport_hours as number) || (distance / 60)

    const allocationResult = validateAllocation(remainingHours, distance, hospitalLevel, transportHours)
    if (!allocationResult.valid) {
      res.status(400).json({
        success: false,
        error: allocationResult.reason,
        allocation_detail: allocationResult,
      })
      return
    }

    const id = uuidv4()
    const distributedAt = new Date().toISOString()
    const bloodType = inv.blood_type as string
    const batchNo = (inv.batch_no as string) || ''

    run(
      `INSERT INTO distributions (id, inventory_id, request_id, hospital_name, blood_type, batch_no, distributed_at, operator) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, inventory_id, request_id, request.hospital_name, bloodType, batchNo, distributedAt, operator]
    )

    run(`UPDATE inventory SET status = 'distributed', blood_type_locked = 1 WHERE id = ?`, [inventory_id])
    run(`UPDATE hospital_requests SET status = 'fulfilled' WHERE id = ?`, [request_id])

    const dist = queryOne('SELECT * FROM distributions WHERE id = ?', [id])
    res.status(201).json({
      success: true,
      data: dist,
      allocation_detail: allocationResult,
    })
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

function validateAllocation(
  remainingHours: number,
  distanceKm: number,
  hospitalLevel: string,
  transportHours: number
): { valid: boolean; reason?: string; score?: number; min_required_hours?: number; details?: Record<string, unknown> } {
  let minRequiredHours: number
  switch (hospitalLevel) {
    case 'tertiary_a':
      minRequiredHours = 6
      break
    case 'tertiary_b':
      minRequiredHours = 8
      break
    case 'secondary':
      minRequiredHours = 12
      break
    default:
      minRequiredHours = 12
  }

  if (distanceKm > 100) {
    minRequiredHours = Math.max(minRequiredHours, 48)
  } else if (distanceKm > 50) {
    minRequiredHours = Math.max(minRequiredHours, 24)
  } else if (distanceKm > 30) {
    minRequiredHours = Math.max(minRequiredHours, 12)
  }

  const safetyBuffer = transportHours * 1.5
  const effectiveMin = minRequiredHours + safetyBuffer

  if (remainingHours < effectiveMin) {
    return {
      valid: false,
      reason: `分配条件不满足：剩余${remainingHours.toFixed(1)}h，需要${effectiveMin.toFixed(1)}h（最低${minRequiredHours}h + 运输安全余量${safetyBuffer.toFixed(1)}h）`,
      min_required_hours: effectiveMin,
      details: {
        remaining_hours: remainingHours,
        min_required_hours: minRequiredHours,
        transport_hours: transportHours,
        safety_buffer: safetyBuffer,
        hospital_level: hospitalLevel,
        distance_km: distanceKm,
      },
    }
  }

  const urgencyScore = hospitalLevel === 'tertiary_a' ? 3 : hospitalLevel === 'tertiary_b' ? 2 : 1
  const expiryScore = remainingHours > 72 ? 3 : remainingHours > 48 ? 2 : 1
  const transportScore = transportHours < 1 ? 3 : transportHours < 2 ? 2 : 1
  const totalScore = urgencyScore + expiryScore + transportScore

  return {
    valid: true,
    score: totalScore,
    min_required_hours: effectiveMin,
    details: {
      remaining_hours: remainingHours,
      min_required_hours: minRequiredHours,
      transport_hours: transportHours,
      safety_buffer: safetyBuffer,
      hospital_level: hospitalLevel,
      distance_km: distanceKm,
      score_breakdown: {
        urgency_score: urgencyScore,
        expiry_score: expiryScore,
        transport_score: transportScore,
        total: totalScore,
      },
    },
  }
}

export default router
