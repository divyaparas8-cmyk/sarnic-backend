import { pool } from './Config/dbConnect.js';
async function setupDb() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS project_files (
        id INT AUTO_INCREMENT PRIMARY KEY,
        project_id INT NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_size VARCHAR(50) NOT NULL,
        file_type VARCHAR(50) NOT NULL,
        file_url TEXT NOT NULL,
        uploaded_by INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('project_files table ensured');
    
    try {
      await pool.query('ALTER TABLE projects ADD COLUMN assigned_team JSON');
      console.log('assigned_team column added');
    } catch(err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('assigned_team column already exists');
      } else {
        throw err;
      }
    }
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
setupDb();
