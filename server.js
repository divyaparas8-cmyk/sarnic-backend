import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'ICS Proxy Server is running' });
});

// ICS Proxy endpoint
app.get('/api/ics-proxy', async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({ 
        error: 'Missing required parameter: url',
        message: 'Please provide an ICS URL as a query parameter: /api/ics-proxy?url=YOUR_ICS_URL'
      });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (e) {
      return res.status(400).json({ 
        error: 'Invalid URL format',
        message: 'Please provide a valid URL'
      });
    }

    console.log(`Fetching ICS from: ${url}`);

    // Fetch the ICS file from the provided URL
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'text/calendar, text/plain, */*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      // Set a timeout (30 seconds)
      timeout: 30000,
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Failed to fetch ICS file`,
        message: `HTTP ${response.status}: ${response.statusText}`,
        url: url
      });
    }

    const text = await response.text();

    if (!text || text.trim().length === 0) {
      return res.status(500).json({
        error: 'Empty response',
        message: 'The ICS file appears to be empty'
      });
    }

    // Validate that it's actually an ICS file
    if (!text.includes('BEGIN:VCALENDAR') && !text.includes('BEGIN:VEVENT')) {
      console.warn('Response might not be a valid ICS file');
    }

    // Set appropriate headers for ICS content
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=300'); // Cache for 5 minutes

    // Send the ICS content
    res.send(text);

  } catch (error) {
    console.error('Error fetching ICS file:', error);
    
    if (error.name === 'AbortError' || error.code === 'ETIMEDOUT') {
      return res.status(504).json({
        error: 'Request timeout',
        message: 'The request to fetch the ICS file timed out'
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'An unexpected error occurred while fetching the ICS file'
    });
  }
});

// Start the server
app.listen(PORT, () => {
  // console.log(`🚀 ICS Proxy Server running on http://localhost:${PORT}`);
  console.log(`📅 Proxy endpoint: http://localhost:${PORT}/api/ics-proxy?url=YOUR_ICS_URL`);
});

