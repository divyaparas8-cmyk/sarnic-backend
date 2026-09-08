-- Run this SQL in your MySQL database (sarnic_new) to create the number_sequences table

CREATE TABLE IF NOT EXISTS number_sequences (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sequence_key VARCHAR(50) NOT NULL UNIQUE,
  label VARCHAR(100) NOT NULL,
  default_start INT NOT NULL DEFAULT 0
);

-- Insert default values (same as the old hardcoded values)
INSERT INTO number_sequences (sequence_key, label, default_start) VALUES
  ('project_no', 'Project Number', 2093),
  ('job_no', 'Job Number', 18542),
  ('estimate_no', 'Estimate Number', 6607),
  ('invoice_no', 'Invoice Number', 5000);
