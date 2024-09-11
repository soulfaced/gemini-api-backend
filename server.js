const express = require('express');
const bodyParser = require('body-parser');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const cors = require('cors');  // Import CORS middleware
require('dotenv').config();

const app = express();
const port = 3000;

// Enable CORS for all origins or specify particular origins
app.use(cors({
    origin: '*',  // Allow requests from this origin
    methods: ['GET', 'POST'],  // Specify allowed methods
    credentials: true
}));

// Initialize Google Generative AI with environment variable
const genAI = new GoogleGenerativeAI('AIzaSyAD84t6GOrLlyVJaU7roJC7jMj9UCOLKqw');  // Use environment variable for API key
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

app.use(bodyParser.json());
app.use(express.static('public')); // Serve static files from 'public' folder

app.post('/generate', async (req, res) => {
    const { title, tasks, date } = req.body;

    if (!title || !tasks || !date) {
        return res.status(400).json({ error: 'Title, tasks, and date are required' });
    }

    const prompt = `Given the title "${title}", the tasks "${tasks}", and the deadline "${date}", divide the tasks equally so that they can be completed by the deadline. Make divisions of tasks such that each division can be done in a single day. For each task, provide the task description along with the due date and time in the following format: "Task: <task description>, Due_Date: <YYYY-MM-DD>, Due_Time: <HH:MM>". List all tasks in this format. give output in json form`;

    try {
        const result = await model.generateContent(prompt);
        const tasksPlan = result.response.text();

        // Clean and parse tasksPlan
        const cleanTasksPlan = tasksPlan.replace(/```json/, '').replace(/```/, '').trim();
        let tasksArray;

        try {
            tasksArray = JSON.parse(cleanTasksPlan);
            console.log("Parsed Tasks Array:", tasksArray);
        } catch (error) {
            console.error("JSON Parsing Error:", error);
            return res.status(500).json({ error: 'Error parsing JSON' });
        }

        // Send the tasks array as JSON
        res.status(200).json({ tasks: tasksArray });

    } catch (error) {
        console.error('Error generating content:', error);
        res.status(500).json({ error: 'Error generating content' });
    }
});

// Separate endpoint to download the ICS file
app.post('/download-ics', (req, res) => {
    const { tasks } = req.body;

    if (!tasks || !Array.isArray(tasks)) {
        return res.status(400).json({ error: 'Tasks data is required' });
    }

    // Create an iCalendar file content
    let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//My Tasks//EN\n";

    tasks.forEach(taskObj => {
        const { Task, Due_Date, Due_Time } = taskObj;
        const dueDate = new Date(`${Due_Date}T${Due_Time}:00`);

        // Format the datetime for the ICS file
        const dueDtStr = dueDate.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');

        // Add the event to the ICS content
        icsContent += (
            "BEGIN:VEVENT\n" +
            `SUMMARY:${Task}\n` +
            `DTSTART:${dueDtStr}\n` +
            `DTEND:${dueDtStr}\n` +
            "END:VEVENT\n"
        );
    });

    // End the ICS content
    icsContent += "END:VCALENDAR\n";

    // Send the ICS file as a response
    res.setHeader('Content-disposition', 'attachment; filename=tasks.ics');
    res.setHeader('Content-type', 'text/calendar');
    res.send(icsContent);
});


app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
