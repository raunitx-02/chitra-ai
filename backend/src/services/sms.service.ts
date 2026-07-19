import twilio from 'twilio';
import axios from 'axios';

const FAST2SMS_API_KEY = process.env.FAST2SMS_API_KEY || '';
const TWOFACTOR_API_KEY = process.env.TWOFACTOR_API_KEY || '';
const TWOFACTOR_TEMPLATE_NAME = process.env.TWOFACTOR_TEMPLATE_NAME || '';

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER || '';

let twilioClient: any = null;

if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
  try {
    twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    console.log('[SMS Service] Twilio Client initialized successfully.');
  } catch (err) {
    console.error('[SMS Service] Failed to initialize Twilio client:', err);
  }
}

if (TWOFACTOR_API_KEY) {
  console.log('[SMS Service] 2Factor.in integration loaded.');
} else if (FAST2SMS_API_KEY) {
  console.log('[SMS Service] Fast2SMS integration loaded.');
} else if (!twilioClient) {
  console.log('[SMS Service] Running in sandbox mode. OTP codes will be printed to console/UI.');
}

/**
 * Sends a 6-digit OTP SMS to the target mobile number.
 */
export async function sendSMSOtp(mobileNumber: string, otp: string): Promise<boolean> {
  const formattedNumber = mobileNumber.startsWith('+') ? mobileNumber : `+${mobileNumber}`;

  // 1. 2Factor.in Integration (Primary Option)
  if (TWOFACTOR_API_KEY) {
    try {
      let cleanNumber = mobileNumber.replace(/[^\d]/g, '');
      if (cleanNumber.length === 10) {
        cleanNumber = `91${cleanNumber}`;
      }

      console.log(`[SMS Service] Sending 2Factor.in OTP to ${cleanNumber}`);
      let url = `https://2factor.in/API/V1/${TWOFACTOR_API_KEY}/SMS/${cleanNumber}/${otp}`;
      if (TWOFACTOR_TEMPLATE_NAME) {
        url += `/${TWOFACTOR_TEMPLATE_NAME}`;
      }

      const response = await axios.get(url, { timeout: 15000 });

      if (response.data && response.data.Status === 'Success') {
        console.log(`[SMS Service] 2Factor.in OTP sent successfully to ${cleanNumber}. Details: ${response.data.Details}`);
        return true;
      } else {
        console.error('[SMS Service] 2Factor.in API returned failure response:', response.data);
      }
    } catch (err: any) {
      console.error('[SMS Service] 2Factor.in sending failed:', err.response?.data || err.message);
    }
  }

  // 2. Fast2SMS Integration (Ideal for Indian numbers)
  if (FAST2SMS_API_KEY) {
    try {
      // Fast2SMS OTP route expects the 10-digit phone number without prefix (+91 or 91)
      let cleanNumber = mobileNumber.replace(/[^\d]/g, '');
      if (cleanNumber.startsWith('91') && cleanNumber.length === 12) {
        cleanNumber = cleanNumber.substring(2);
      }

      console.log(`[SMS Service] Sending Fast2SMS OTP to ${cleanNumber}`);
      const response = await axios.post('https://www.fast2sms.com/dev/bulkV2', {
        route: 'otp',
        variables_values: otp,
        numbers: cleanNumber
      }, {
        headers: {
          'authorization': FAST2SMS_API_KEY,
          'Content-Type': 'application/json'
        }
      });

      if (response.data && response.data.return === true) {
        console.log(`[SMS Service] Fast2SMS OTP sent successfully to ${cleanNumber}`);
        return true;
      } else {
        console.error('[SMS Service] Fast2SMS API returned failure response:', response.data);
        return false;
      }
    } catch (err: any) {
      console.error('[SMS Service] Fast2SMS sending failed:', err.response?.data || err.message);
      return false;
    }
  }

  // 2. Twilio Fallback
  const messageBody = `[RetailStacker AI] Your verification code is ${otp}. Valid for 5 minutes.`;
  if (twilioClient && TWILIO_PHONE_NUMBER) {
    try {
      await twilioClient.messages.create({
        body: messageBody,
        from: TWILIO_PHONE_NUMBER,
        to: formattedNumber,
      });
      console.log(`[SMS Service] Real Twilio SMS sent successfully to ${formattedNumber}`);
      return true;
    } catch (err: any) {
      console.error(`[SMS Service] Failed to send real Twilio SMS to ${formattedNumber}:`, err.message);
      console.log(`[SANDBOX OTP FALLBACK] Verification Code for ${formattedNumber}: ${otp}`);
      return false;
    }
  }

  // 3. Sandbox Sandbox Fallback
  console.log(`\n==============================================\n[SANDBOX OTP] Verification Code for ${formattedNumber}: ${otp}\n==============================================\n`);
  return false;
}
