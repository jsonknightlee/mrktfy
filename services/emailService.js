// Email Service for sending invoices and renewal reminders

const API_BASE_URL = 'http://192.168.1.74:3001';
const API_KEY = '804276f41491b35e448d41fdb321d66f460a272fed36da3840463c480c505f2e';

/**
 * Send subscription invoice email
 * @param {Object} subscriptionData - Subscription details
 * @param {Object} userData - User information
 * @returns {Promise<boolean>} - Success status
 */
export const sendSubscriptionInvoice = async (subscriptionData, userData) => {
  try {
    console.log('📧 [EMAIL] Sending subscription invoice:', {
      subscriptionLevel: subscriptionData.SubscriptionLevelID,
      amount: subscriptionData.BillingAmount,
      email: userData.Email || userData.email
    });

    const response = await fetch(`${API_BASE_URL}/api/email/invoice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY,
      },
      body: JSON.stringify({
        to: userData.Email || userData.email,
        subject: `Mrktfy Subscription Invoice - ${subscriptionData.SubscriptionLevelID?.toUpperCase()} Plan`,
        template: 'invoice',
        data: {
          customerName: `${userData.FirstName || userData.firstName || ''} ${userData.LastName || userData.lastName || ''}`.trim() || userData.Username,
          subscriptionLevel: subscriptionData.SubscriptionLevelID,
          amount: subscriptionData.BillingAmount,
          billingInterval: subscriptionData.BillingInterval || 'month',
          startDate: subscriptionData.SubscriptionStartDate,
          endDate: subscriptionData.SubscriptionEndDate,
          autoRenew: subscriptionData.AutoRenew || false,
          invoiceNumber: `INV-${Date.now()}`,
          invoiceDate: new Date().toISOString()
        }
      })
    });

    if (response.ok) {
      console.log('✅ [EMAIL] Invoice sent successfully');
      return true;
    } else {
      console.error('❌ [EMAIL] Failed to send invoice:', response.status);
      return false;
    }
  } catch (error) {
    console.error('❌ [EMAIL] Error sending invoice:', error);
    return false;
  }
};

/**
 * Send renewal reminder email
 * @param {Object} subscriptionData - Subscription details
 * @param {Object} userData - User information
 * @param {number} daysBeforeRenewal - Days before renewal (default: 7)
 * @returns {Promise<boolean>} - Success status
 */
export const sendRenewalReminder = async (subscriptionData, userData, daysBeforeRenewal = 7) => {
  try {
    if (!subscriptionData.SubscriptionEndDate) {
      console.log('📧 [EMAIL] No end date found, skipping renewal reminder');
      return false;
    }

    const renewalDate = new Date(subscriptionData.SubscriptionEndDate);
    const reminderDate = new Date(renewalDate);
    reminderDate.setDate(reminderDate.getDate() - daysBeforeRenewal);

    console.log('📧 [EMAIL] Sending renewal reminder:', {
      subscriptionLevel: subscriptionData.SubscriptionLevelID,
      renewalDate: renewalDate.toISOString(),
      reminderDate: reminderDate.toISOString(),
      daysBefore: daysBeforeRenewal,
      email: userData.Email || userData.email
    });

    const response = await fetch(`${API_BASE_URL}/api/email/renewal-reminder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY,
      },
      body: JSON.stringify({
        to: userData.Email || userData.email,
        subject: `Mrktfy Subscription Renewal Reminder - ${daysBeforeRenewal} days`,
        template: 'renewal-reminder',
        data: {
          customerName: `${userData.FirstName || userData.firstName || ''} ${userData.LastName || userData.lastName || ''}`.trim() || userData.Username,
          subscriptionLevel: subscriptionData.SubscriptionLevelID,
          amount: subscriptionData.BillingAmount,
          renewalDate: renewalDate.toISOString(),
          daysBeforeRenewal: daysBeforeRenewal,
          autoRenew: subscriptionData.AutoRenew || false,
          manageSubscriptionUrl: 'https://mrktfy.app/profile' // Link to manage subscription
        }
      })
    });

    if (response.ok) {
      console.log('✅ [EMAIL] Renewal reminder sent successfully');
      return true;
    } else {
      console.error('❌ [EMAIL] Failed to send renewal reminder:', response.status);
      return false;
    }
  } catch (error) {
    console.error('❌ [EMAIL] Error sending renewal reminder:', error);
    return false;
  }
};

/**
 * Send cancellation confirmation email
 * @param {Object} subscriptionData - Subscription details
 * @param {Object} userData - User information
 * @returns {Promise<boolean>} - Success status
 */
export const sendCancellationConfirmation = async (subscriptionData, userData) => {
  try {
    console.log('📧 [EMAIL] Sending cancellation confirmation:', {
      subscriptionLevel: subscriptionData.SubscriptionLevelID,
      endDate: subscriptionData.SubscriptionEndDate,
      email: userData.Email || userData.email
    });

    const response = await fetch(`${API_BASE_URL}/api/email/cancellation-confirmation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY,
      },
      body: JSON.stringify({
        to: userData.Email || userData.email,
        subject: 'Mrktfy Subscription Cancellation Confirmation',
        template: 'cancellation-confirmation',
        data: {
          customerName: `${userData.FirstName || userData.firstName || ''} ${userData.LastName || userData.lastName || ''}`.trim() || userData.Username,
          subscriptionLevel: subscriptionData.SubscriptionLevelID,
          cancellationDate: new Date().toISOString(),
          endDate: subscriptionData.SubscriptionEndDate,
          accessUntilDate: subscriptionData.SubscriptionEndDate,
          reactivateUrl: 'https://mrktfy.app/profile' // Link to reactivate subscription
        }
      })
    });

    if (response.ok) {
      console.log('✅ [EMAIL] Cancellation confirmation sent successfully');
      return true;
    } else {
      console.error('❌ [EMAIL] Failed to send cancellation confirmation:', response.status);
      return false;
    }
  } catch (error) {
    console.error('❌ [EMAIL] Error sending cancellation confirmation:', error);
    return false;
  }
};

/**
 * Schedule renewal reminders (to be called by backend cron job)
 * @returns {Promise<boolean>} - Success status
 */
export const scheduleRenewalReminders = async () => {
  try {
    console.log('📧 [EMAIL] Checking for upcoming renewals...');

    const response = await fetch(`${API_BASE_URL}/api/email/schedule-renewal-reminders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY,
      }
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ [EMAIL] Renewal reminders scheduled:', result);
      return true;
    } else {
      console.error('❌ [EMAIL] Failed to schedule renewal reminders:', response.status);
      return false;
    }
  } catch (error) {
    console.error('❌ [EMAIL] Error scheduling renewal reminders:', error);
    return false;
  }
};

export default {
  sendSubscriptionInvoice,
  sendRenewalReminder,
  sendCancellationConfirmation,
  scheduleRenewalReminders
};
