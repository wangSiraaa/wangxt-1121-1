import initSqlJs, { type Database } from 'sql.js'
import { v4 as uuidv4 } from 'uuid'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DB_PATH = path.resolve(__dirname, '../data/platelet.db')
const DATA_DIR = path.dirname(DB_PATH)

let db: Database

export function getDb(): Database {
  return db
}

export async function initDb(): Promise<Database> {
  if (db) return db

  const SQL = await initSqlJs()

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }

  let buf: Buffer | undefined
  if (fs.existsSync(DB_PATH)) {
    buf = fs.readFileSync(DB_PATH)
  }

  db = buf ? new SQL.Database(buf) : new SQL.Database()

  createTables()
  seedData()
  saveDb()

  return db
}

export function saveDb(): void {
  const data = db.export()
  const buffer = Buffer.from(data)
  fs.writeFileSync(DB_PATH, buffer)
}

function createTables(): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS donors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      blood_type TEXT NOT NULL,
      phone TEXT NOT NULL,
      gender TEXT NOT NULL,
      birth_date TEXT NOT NULL,
      donation_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS slots (
      id TEXT PRIMARY KEY,
      donor_id TEXT,
      date TEXT NOT NULL,
      time_start TEXT NOT NULL,
      time_end TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'available',
      created_at TEXT NOT NULL,
      FOREIGN KEY (donor_id) REFERENCES donors(id)
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS screenings (
      id TEXT PRIMARY KEY,
      appointment_id TEXT,
      donor_id TEXT NOT NULL,
      hbsag TEXT NOT NULL DEFAULT 'negative',
      hcv TEXT NOT NULL DEFAULT 'negative',
      hiv TEXT NOT NULL DEFAULT 'negative',
      syphilis TEXT NOT NULL DEFAULT 'negative',
      alt_value REAL DEFAULT 0,
      result TEXT NOT NULL,
      screened_at TEXT NOT NULL,
      screener TEXT NOT NULL,
      FOREIGN KEY (appointment_id) REFERENCES slots(id),
      FOREIGN KEY (donor_id) REFERENCES donors(id)
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS inventory (
      id TEXT PRIMARY KEY,
      screening_id TEXT,
      donor_id TEXT NOT NULL,
      blood_type TEXT NOT NULL,
      collection_time TEXT NOT NULL,
      expiry_time TEXT NOT NULL,
      volume_ml INTEGER DEFAULT 250,
      status TEXT NOT NULL DEFAULT 'available',
      blood_type_locked INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (screening_id) REFERENCES screenings(id),
      FOREIGN KEY (donor_id) REFERENCES donors(id)
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS hospital_requests (
      id TEXT PRIMARY KEY,
      hospital_name TEXT NOT NULL,
      distance_km REAL NOT NULL,
      blood_type TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      urgency TEXT NOT NULL DEFAULT 'routine',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS distributions (
      id TEXT PRIMARY KEY,
      inventory_id TEXT NOT NULL,
      request_id TEXT NOT NULL,
      hospital_name TEXT NOT NULL,
      distributed_at TEXT NOT NULL,
      operator TEXT NOT NULL,
      FOREIGN KEY (inventory_id) REFERENCES inventory(id),
      FOREIGN KEY (request_id) REFERENCES hospital_requests(id)
    )
  `)
}

function seedData(): void {
  const donorCount = queryVal(`SELECT COUNT(*) as c FROM donors`) as number
  if (donorCount > 0) return

  const now = new Date()
  const today = now.toISOString().split('T')[0]

  const donors = [
    { name: '张伟', blood_type: 'A+', phone: '13800100001', gender: '男', birth_date: '1990-03-15' },
    { name: '李娜', blood_type: 'O+', phone: '13800100002', gender: '女', birth_date: '1988-07-22' },
    { name: '王强', blood_type: 'B+', phone: '13800100003', gender: '男', birth_date: '1995-01-10' },
    { name: '赵敏', blood_type: 'AB+', phone: '13800100004', gender: '女', birth_date: '1992-11-05' },
    { name: '刘洋', blood_type: 'A-', phone: '13800100005', gender: '男', birth_date: '1987-06-18' },
    { name: '陈静', blood_type: 'O-', phone: '13800100006', gender: '女', birth_date: '1993-09-30' },
    { name: '杨帆', blood_type: 'B-', phone: '13800100007', gender: '男', birth_date: '1991-04-12' },
    { name: '周婷', blood_type: 'A+', phone: '13800100008', gender: '女', birth_date: '1996-02-28' },
    { name: '吴磊', blood_type: 'O+', phone: '13800100009', gender: '男', birth_date: '1989-12-03' },
    { name: '孙丽', blood_type: 'AB-', phone: '13800100010', gender: '女', birth_date: '1994-08-17' },
    { name: '马超', blood_type: 'B+', phone: '13800100011', gender: '男', birth_date: '1986-05-25' },
    { name: '黄蓉', blood_type: 'A+', phone: '13800100012', gender: '女', birth_date: '1997-10-09' },
  ]

  const donorIds: string[] = []
  for (const d of donors) {
    const id = uuidv4()
    donorIds.push(id)
    db.run(
      `INSERT INTO donors (id, name, blood_type, phone, gender, birth_date, donation_count, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, d.name, d.blood_type, d.phone, d.gender, d.birth_date, Math.floor(Math.random() * 10), now.toISOString()]
    )
  }

  const slotStatuses = ['available', 'booked', 'completed', 'available', 'booked', 'available', 'completed', 'available', 'booked', 'available', 'available', 'available'] as const
  const slotIds: string[] = []
  const bookedSlotIds: string[] = []
  for (let i = 0; i < 12; i++) {
    const id = uuidv4()
    slotIds.push(id)
    const status = slotStatuses[i]
    const donorId = (status === 'booked' || status === 'completed') ? donorIds[i] : null
    const dayOffset = Math.floor(i / 4)
    const slotDate = new Date(now)
    slotDate.setDate(slotDate.getDate() + dayOffset)
    const dateStr = slotDate.toISOString().split('T')[0]
    const hour = 8 + (i % 4) * 2

    if (status === 'booked') bookedSlotIds.push(id)

    db.run(
      `INSERT INTO slots (id, donor_id, date, time_start, time_end, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, donorId, dateStr, `${String(hour).padStart(2, '0')}:00`, `${String(hour + 2).padStart(2, '0')}:00`, status, now.toISOString()]
    )
  }

  const screeningData = [
    { slotIdx: 2, donorIdx: 2, hbsag: 'negative', hcv: 'negative', hiv: 'negative', syphilis: 'negative', alt_value: 25, result: 'passed', screener: '李医生' },
    { slotIdx: 6, donorIdx: 6, hbsag: 'negative', hcv: 'negative', hiv: 'negative', syphilis: 'negative', alt_value: 18, result: 'passed', screener: '王医生' },
    { slotIdx: 2, donorIdx: 0, hbsag: 'negative', hcv: 'negative', hiv: 'negative', syphilis: 'negative', alt_value: 30, result: 'passed', screener: '李医生' },
    { slotIdx: 6, donorIdx: 4, hbsag: 'negative', hcv: 'positive', hiv: 'negative', syphilis: 'negative', alt_value: 55, result: 'failed', screener: '张医生' },
    { slotIdx: 2, donorIdx: 1, hbsag: 'negative', hcv: 'negative', hiv: 'negative', syphilis: 'negative', alt_value: 22, result: 'passed', screener: '王医生' },
    { slotIdx: 6, donorIdx: 7, hbsag: 'positive', hcv: 'negative', hiv: 'negative', syphilis: 'negative', alt_value: 60, result: 'failed', screener: '李医生' },
  ]

  const screeningIds: string[] = []
  for (const s of screeningData) {
    const id = uuidv4()
    screeningIds.push(id)
    const screenedAt = new Date(now.getTime() - Math.random() * 86400000 * 2)
    db.run(
      `INSERT INTO screenings (id, appointment_id, donor_id, hbsag, hcv, hiv, syphilis, alt_value, result, screened_at, screener) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, slotIds[s.slotIdx], donorIds[s.donorIdx], s.hbsag, s.hcv, s.hiv, s.syphilis, s.alt_value, s.result, screenedAt.toISOString(), s.screener]
    )
  }

  const inventoryData = [
    { screeningIdx: 0, donorIdx: 2, blood_type: 'B+', hoursAgo: 48, status: 'available' },
    { screeningIdx: 1, donorIdx: 6, blood_type: 'B-', hoursAgo: 36, status: 'available' },
    { screeningIdx: 2, donorIdx: 0, blood_type: 'A+', hoursAgo: 72, status: 'available' },
    { screeningIdx: 3, donorIdx: 4, blood_type: 'A-', hoursAgo: 24, status: 'discarded' },
    { screeningIdx: 4, donorIdx: 1, blood_type: 'O+', hoursAgo: 12, status: 'available' },
    { screeningIdx: 5, donorIdx: 7, blood_type: 'A+', hoursAgo: 60, status: 'discarded' },
    { screeningIdx: 0, donorIdx: 2, blood_type: 'B+', hoursAgo: 96, status: 'expired' },
    { screeningIdx: 1, donorIdx: 6, blood_type: 'B-', hoursAgo: 108, status: 'distributed' },
  ]

  const inventoryIds: string[] = []
  for (const inv of inventoryData) {
    const id = uuidv4()
    inventoryIds.push(id)
    const collTime = new Date(now.getTime() - inv.hoursAgo * 3600000)
    const expTime = new Date(collTime.getTime() + 5 * 86400000)
    const locked = inv.status === 'distributed' ? 1 : 0
    db.run(
      `INSERT INTO inventory (id, screening_id, donor_id, blood_type, collection_time, expiry_time, volume_ml, status, blood_type_locked, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, screeningIds[inv.screeningIdx], donorIds[inv.donorIdx], inv.blood_type, collTime.toISOString(), expTime.toISOString(), 250, inv.status, locked, collTime.toISOString()]
    )
  }

  const requestData = [
    { hospital_name: '市中心医院', distance_km: 15, blood_type: 'A+', quantity: 2, urgency: 'routine' as const, status: 'pending' },
    { hospital_name: '省人民医院', distance_km: 85, blood_type: 'O+', quantity: 3, urgency: 'urgent' as const, status: 'pending' },
    { hospital_name: '开发区医院', distance_km: 120, blood_type: 'B+', quantity: 1, urgency: 'critical' as const, status: 'pending' },
    { hospital_name: '大学附属医院', distance_km: 30, blood_type: 'AB+', quantity: 2, urgency: 'routine' as const, status: 'fulfilled' },
    { hospital_name: '第二人民医院', distance_km: 55, blood_type: 'A-', quantity: 1, urgency: 'urgent' as const, status: 'cancelled' },
  ]

  const requestIds: string[] = []
  for (const r of requestData) {
    const id = uuidv4()
    requestIds.push(id)
    db.run(
      `INSERT INTO hospital_requests (id, hospital_name, distance_km, blood_type, quantity, urgency, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, r.hospital_name, r.distance_km, r.blood_type, r.quantity, r.urgency, r.status, now.toISOString()]
    )
  }

  const distInvIdx = 7
  const distReqIdx = 3
  const distId = uuidv4()
  db.run(
    `INSERT INTO distributions (id, inventory_id, request_id, hospital_name, distributed_at, operator) VALUES (?, ?, ?, ?, ?, ?)`,
    [distId, inventoryIds[distInvIdx], requestIds[distReqIdx], requestData[distReqIdx].hospital_name, now.toISOString(), '赵管理员']
  )
}

export function queryAll<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const rows: T[] = []
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as T)
  }
  stmt.free()
  return rows
}

export function queryOne<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T | null {
  const rows = queryAll<T>(sql, params)
  return rows.length > 0 ? rows[0] : null
}

export function queryVal(sql: string, params: unknown[] = []): unknown {
  const row = queryOne<Record<string, unknown>>(sql, params)
  if (!row) return null
  return Object.values(row)[0]
}

export function run(sql: string, params: unknown[] = []): void {
  db.run(sql, params)
  saveDb()
}
