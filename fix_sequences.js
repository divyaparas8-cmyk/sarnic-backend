import { pool } from './Config/dbConnect.js';

async function fix() {
  try {
    await pool.query("UPDATE number_sequences SET default_start = (SELECT COALESCE(MAX(estimate_no), 0) FROM estimates) WHERE sequence_key = 'estimate_no'");
    await pool.query("UPDATE number_sequences SET default_start = (SELECT COALESCE(MAX(invoice_no), 0) FROM invoices) WHERE sequence_key = 'invoice_no'");
    console.log('Fixed sequences successfully!');
  } catch (error) {
    console.error('Error fixing sequences:', error);
  } finally {
    pool.end();
  }
}

fix();
