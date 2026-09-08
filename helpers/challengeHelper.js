// import pool from '../config/db.js'; // adjust if different
import { pool } from "../Config/dbConnect.js";
export const getUserChallengeProgressData = async (user_id) => {
    const [progress] = await pool.query(
        `SELECT u.firstname, u.email, 
                s.plan_name, s.promocode,
                (SELECT MIN(pt.timestamp) 
                 FROM progress_tracking pt 
                 WHERE pt.user_id = ?) AS challenge_start_date
         FROM users u 
         LEFT JOIN subscriptions s ON u.id = s.user_id
         WHERE u.id = ?`,
        [user_id, user_id]
    );

    if (!progress.length || !progress[0]?.challenge_start_date) {
        throw new Error("User has not started the challenge.");
    }

    const challengeStartDate = progress[0].challenge_start_date;
    const elapsedDays = Math.min(Math.floor((new Date() - new Date(challengeStartDate)) / (1000 * 60 * 60 * 24)), 30);

    const [books] = await pool.query(
        `SELECT btr.book_id, btr.status, btr.attempt_number, 
                btr.correct_answers, btr.total_questions, btr.created_at,
                (btr.correct_answers / NULLIF(btr.total_questions, 0)) * 100 AS test_score,
                CASE 
                    WHEN btr.attempt_number = 1 AND btr.status IN ('Completed Successfully', 'Completed') THEN 1
                    ELSE 0
                END AS first_attempt_pass
         FROM book_test_results btr
         WHERE btr.user_id = ? 
         AND btr.status IN ('Completed Successfully', 'Completed')
         ORDER BY btr.created_at ASC`,
        [user_id]
    );

    const challengeCount = books.filter(book => book.first_attempt_pass === 1).length;
    const validScores = books.map(book => book.test_score).filter(score => score !== null);
    const avgTestScore = validScores.length
        ? (validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(2)
        : 'N/A';
    const badgeEarn = books.filter(book => book.test_score > 80).length;

    return {
        firstname: progress[0].firstname,
        email: progress[0].email,
        elapsed_days: elapsedDays,
        books_completed: challengeCount,
        remaining_books: Math.max(0, 30 - challengeCount),
        avg_test_score: avgTestScore,
        badgeEarn,
    };
};
