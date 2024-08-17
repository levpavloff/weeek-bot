require('dotenv').config();
const axios = require('axios');

const clientId = process.env.zClientId; // Ваш Client ID
const clientSecret = process.env.zClientSecret; // Ваш Client Secret
const accountId = process.env.zAccoundId; // Ваш Account ID

// Функция для получения OAuth токена
async function getAccessToken() {
    const tokenUrl = `https://zoom.us/oauth/token`;
    const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const requestData = {
        grant_type: 'account_credentials',
        account_id: accountId
    };

    try {
        const response = await axios.post(tokenUrl, null, {
            headers: {
                Authorization: `Basic ${authHeader}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            params: requestData
        });

        return response.data.access_token;
    } catch (error) {
        console.error('Error fetching access token:', error.response ? error.response.data : error.message);
        throw error;
    }
}

// Пример использования токена для создания встречи
async function createZoomMeeting(meetingParams) {
    const accessToken = await getAccessToken();
    const { project, date, description, participants } = meetingParams.data;

    const meetingData = {
        topic: `${project}: ${description}`,
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
