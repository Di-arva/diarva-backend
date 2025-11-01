const express = require('express');
const router = express.Router();
const { sendEmail } = require('../services/commService');

router.post('/send-email', async (req, res) => {
  try {
    const { name, email, phone, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ 
        success: false,
        message: 'Missing required fields: name, email, and message are required' 
      });
    }

    const subject = `New Contact Form Submission from ${name}`;
    const text = `
New Contact Form Submission

Name: ${name}
Email: ${email}
Phone: ${phone || 'Not provided'}

Message:
${message}
    `.trim();

    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #f8f9fa; padding: 20px; border-radius: 10px; }
    .detail { margin: 10px 0; padding: 10px; background: #f8f9fa; border-radius: 5px; }
    .label { font-weight: bold; color: #2c5aa0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>New Contact Form Submission</h2>
      <p>You have received a new message from your website contact form.</p>
    </div>
    
    <div class="detail">
      <span class="label">Name:</span> ${name}
    </div>
    
    <div class="detail">
      <span class="label">Email:</span> ${email}
    </div>
    
    <div class="detail">
      <span class="label">Phone:</span> ${phone || 'Not provided'}
    </div>
    
    <div class="detail">
      <span class="label">Message:</span><br>
      ${message.replace(/\n/g, '<br>')}
    </div>
    
    <p style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd;">
      <em>This email was sent from your website contact form.</em>
    </p>
  </div>
</body>
</html>
    `;

    const result = await sendEmail({
      to: process.env.CONTACT_EMAIL || 'admin@diarva.com',
      subject,
      html,
      text,
      replyTo: email,
    });

    console.log('Email sent successfully:', result.MessageId);
    
    res.status(200).json({ 
      success: true,
      message: 'Email sent successfully',
      messageId: result.MessageId 
    });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to send email',
      error: error.message 
    });
  }
});

module.exports = router;