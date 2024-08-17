const axios = require('axios');
const qs = require('qs'); // Для работы с query строками
require('dotenv').config();

// Zoom API конфигурация
const clientId = process.env.zClientId; // Ваш Client ID
const clientSecret = process.env.zClientSecret; // Ваш Client Secret

// Функция для получения OAuth токена
async function getAccessToken() {
    const tokenUrl = 'https://zoom.us/oauth/token';
    const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const requestData = {
        grant_type: 'client_credentials'
    };

    try {
        const response = await axios.post(tokenUrl, qs.stringify(requestData), {
            headers: {
                Authorization: `Basic ${authHeader}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        return response.data.access_token;
    } catch (error) {
        console.error('Error fetching access token:', error.response ? error.response.data : error.message);
        throw error;
    }
}

// Функция для создания встречи в Zoom
async function createZoomMeeting(meetingParams) {
    const accessToken = await getAccessToken();
    const { project, date, description, participants } = meetingParams.data;

    // Данные для создания встречи
    const meetingData = {
        topic: project,
        type: 2, // Scheduled meeting
        start_time: date,
        duration: 60, // Время встречи в минутах
        timezone: 'UTC',
        agenda: description,
        settings: {
            host_video: true,
            participant_video: true,
            mute_upon_entry: true,
            waiting_room: true,
        }
    };

    try {
        const response = await axios.post(
            `https://api.zoom.us/v2/users/me/meetings`,
            meetingData,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        return {
            success: true,
            meetingDetails: response.data
        };
    } catch (error) {
        console.error('Error creating Zoom meeting:', error.response ? error.response.data : error.message);
        return {
            success: false,
            error: error.response ? error.response.data : error.message
        };
    }
}

module.exports = { createZoomMeeting };
