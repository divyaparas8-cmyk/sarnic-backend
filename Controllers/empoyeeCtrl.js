import { pool } from "../Config/dbConnect.js";

export const addempoyee = async (req, res) => {
    try {
        const { username, email, password } = req.body
        const existingstaff = await pool.query("SELECT email FROM empoyee WHERE email=?", email)
        if(!existingstaff){
            return res.status(403).json("staff already exist")
        }
        else{
            const hashpassword = await bcrypt.hash(password, 10)
            const staffdata = {
                username, 
                email,
                password : hashpassword,
            }
            const [result] = await pool.query("INSERT INTO staff SET ?", staffdata)
            if (result) {
                return res.status(200).json({ message: `${username} created sucessfully`, data: staffdata });
            }
            else {
                return res.status(404).json({ message: "staff not created" });
            }
        }
    }
    catch (error) {
        return res.result.status(500).json({ message: "internal server error", error: error.message });
    }  
}
export const getempoyee = async (req, res) => {
}

export const getWorkLogByEmployee = async (req, res) => {
  try {
    const { employeeId } = req.params;

    /* =====================
       TABLE ROWS
    ====================== */
    const [logs] = await pool.query(
      `
      SELECT 
        DATE_FORMAT(twl.date, '%d/%m/%Y') AS date,
        IFNULL(aj.task_description, '-') AS task_description,
        CONCAT(u.first_name, ' ', u.last_name) AS employee_name,
        IFNULL(aj.time_budget, '00:00') AS time_budget,
        IFNULL(twl.time, '00:00') AS time_spent,
        IFNULL(twl.overtime, '00:00') AS over_time,

        SEC_TO_TIME(
          TIME_TO_SEC(IFNULL(twl.time,'00:00:00')) +
          TIME_TO_SEC(IFNULL(twl.overtime,'00:00:00'))
        ) AS total_time

      FROM time_work_logs twl

      LEFT JOIN jobs j 
        ON twl.job_id = j.id

      LEFT JOIN assign_jobs aj 
        ON aj.employee_id = twl.employee_id
       AND JSON_CONTAINS(aj.job_ids, JSON_ARRAY(j.id))

      LEFT JOIN users u 
        ON twl.employee_id = u.id

      WHERE twl.employee_id = ?
      ORDER BY twl.date DESC, twl.id DESC
      `,
      [employeeId]
    );

    /* =====================
       BOTTOM SUMMARY
    ====================== */
    const [[summary]] = await pool.query(
      `
      SELECT
        SEC_TO_TIME(SUM(TIME_TO_SEC(IFNULL(time,'00:00:00')))) AS workTime,
        SEC_TO_TIME(SUM(TIME_TO_SEC(IFNULL(overtime,'00:00:00')))) AS overTime,
        SEC_TO_TIME(
          SUM(
            TIME_TO_SEC(IFNULL(time,'00:00:00')) +
            TIME_TO_SEC(IFNULL(overtime,'00:00:00'))
          )
        ) AS totalTime
      FROM time_work_logs
      WHERE employee_id = ?
      `,
      [employeeId]
    );

    res.json({
      success: true,
      data: {
        logs,
        summary: {
          workTime: summary.workTime || "00:00",
          overTime: summary.overTime || "00:00",
          totalTime: summary.totalTime || "00:00",
          timeBudget: "00:00"
        }
      }
    });

  } catch (error) {
    console.error("WORK LOG ERROR:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


