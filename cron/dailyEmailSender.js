


import cron from 'node-cron';
import nodemailer from 'nodemailer';
import { pool } from "../Config/dbConnect.js";
import { getUserChallengeProgressData } from '../helpers/challengeHelper.js';

// Setup nodemailer transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'gautambairagi221999@gmail.com',
        pass: 'dahr yool ehhg hyib',
    },
});

// Run every day at 6:20 PM
cron.schedule('29 18 * * *', async () => {
    console.log("📬 Starting daily challenge email job...");

    try {
        const [users] = await pool.query(`
            SELECT u.id, u.email 
            FROM users u 
            JOIN subscriptions s ON u.id = s.user_id 
            WHERE LOWER(s.plan_name) = '1 month' AND s.is_active = 1
        `);

        if (users.length === 0) {
            console.log("⚠️ No eligible users found.");
            return;
        }

        await Promise.all(users.map(async (user) => {
            try {
                const data = await getUserChallengeProgressData(user.id); // Get personalized data

                const mailOptions = {
                    from: 'gautambairagi221999@gmail.com',
                    to: data.email,
                    subject: `🔥 Day ${data.elapsed_days + 1} of Your Challenge!`,
                    text: `
Hello ${data.firstname},

Here’s your progress so far in the 30-Day Challenge:

📚 Books Completed: ${data.books_completed}
🎯 Remaining Books: ${data.remaining_books}
📊 Avg. Test Score: ${data.avg_test_score}%
🏅 Badges Earned: ${data.badgeEarn}

💪 Motivational Boost:
You're on Day ${data.elapsed_days + 1}! Keep pushing. Each day brings you closer to your free 11 months!

Stay consistent. You've got this! 💥

– Team Book Challenge
                    `
                };

                await transporter.sendMail(mailOptions);
                console.log(`✅ Email sent to ${data.email}`);
            } catch (err) {
                console.error(`❌ Error for user ID ${user.id}:`, err.message);
            }
        }));

    } catch (err) {
        console.error("❌ Failed to run email cron job:", err.message);
    }
});
