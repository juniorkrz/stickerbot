import 'dotenv/config'

import { drizzle } from 'drizzle-orm/mysql2'
import fs from 'fs'
import mysql from 'mysql2/promise'
import { Database, open } from 'sqlite'
import sqlite3 from 'sqlite3'

import { bot } from '../config'
import { banned, usage, vips } from '../db/schema'

const migrate = async () => {
  const sqlitePath = process.env.SQLITE_DB_PATH || `/data/${bot.sessionId}/db/database.sqlite`

  if (!fs.existsSync(sqlitePath)) {
    console.error(`\n❌ SQLite database not found at ${sqlitePath}`)
    console.log('If your old .sqlite file is located somewhere else, please set the SQLITE_DB_PATH environment variable.')
    console.log('Example: SQLITE_DB_PATH=./database.sqlite npm run migrate-db\n')
    process.exit(1)
  }

  console.log(`\n📦 Opening SQLite database from ${sqlitePath}...`)
  const sqliteDb = await open({
    filename: sqlitePath,
    driver: sqlite3.Database
  })

  console.log(`🔌 Connecting to MySQL (${bot.dbHost}:${bot.dbPort})...`)
  const pool = mysql.createPool({
    host: bot.dbHost,
    user: bot.dbUser,
    password: bot.dbPassword,
    database: bot.dbName,
    port: bot.dbPort,
  })

  // Validate MySQL connection
  try {
    const connection = await pool.getConnection()
    console.log('✅ Connected to MySQL successfully.')
    connection.release()
  } catch (error: any) {
    console.error(`\n❌ Failed to connect to MySQL: ${error.message}`)
    console.log('\nPlease check your database credentials in the .env file.')
    process.exit(1)
  }

  const mysqlDb = drizzle(pool)

  // Ensure tables exist before migration
  console.log('🛠️  Ensuring MySQL tables exist...')
  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`Usage\` (
      \`type\` VARCHAR(191) PRIMARY KEY,
      \`count\` INT NOT NULL DEFAULT 0
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`Vips\` (
      \`jid\` VARCHAR(191) PRIMARY KEY,
      \`expires\` DATETIME NOT NULL,
      \`permanent\` TINYINT(1) NOT NULL DEFAULT 0
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`Banned\` (
      \`user\` VARCHAR(191) PRIMARY KEY
    )
  `)
  console.log('✅ Tables are ready.')

  console.log('🚀 Starting Data Migration...\n')

  // 1. Migrate Usage
  try {
    const usageRows = await sqliteDb.all('SELECT * FROM Usage')
    console.log(`Migrating Usage table... (${usageRows.length} rows)`)
    
    if (usageRows.length > 0) {
      console.log('Sample row from SQLite:', JSON.stringify(usageRows[0], null, 2))
    }

    for (const row of usageRows) {
      try {
        await mysqlDb.insert(usage).values({ type: row.type,
          count: row.count })
      } catch (e: any) {
        console.warn(`  ⚠️  Failed to migrate Usage row ${row.type}: ${e.message}`)
      }
    }
    console.log('✅ Usage table migrated successfully.\n')
  } catch (error) {
    console.error('❌ Failed fetching Usage from SQLite.', error)
  }

  // 2. Migrate VIPs
  try {
    const vipsRows = await sqliteDb.all('SELECT * FROM Vips')
    console.log(`Migrating Vips table... (${vipsRows.length} rows)`)
    for (const row of vipsRows) {
      try {
        await mysqlDb.insert(vips).values({
          jid: row.jid,
          expires: new Date(row.expires),
          permanent: row.permanent
        })
      } catch (e: any) {
        console.warn(`  ⚠️  Failed to migrate Vip ${row.jid}: ${e.message}`)
      }
    }
    console.log('✅ Vips table migrated successfully.\n')
  } catch (error) {
    console.error('❌ Failed fetching Vips from SQLite.', error)
  }

  // 3. Migrate Banned
  try {
    const bannedRows = await sqliteDb.all('SELECT * FROM Banned')
    console.log(`Migrating Banned table... (${bannedRows.length} rows)`)
    for (const row of bannedRows) {
      try {
        await mysqlDb.insert(banned).values({ user: row.user })
      } catch (e: any) {
        console.warn(`  ⚠️  Failed to migrate Banned ${row.user}: ${e.message}`)
      }
    }
    console.log('✅ Banned table migrated successfully.\n')
  } catch (error) {
    console.error('❌ Failed fetching Banned from SQLite.', error)
  }

  console.log('🎉 Migration completed successfully!')
  process.exit(0)
}

migrate().catch(error => {
  console.error('\n❌ Unhandled Migration Error:', error)
  process.exit(1)
})
