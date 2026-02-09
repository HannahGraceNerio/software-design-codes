export const STATUS_CONFIGS = {
    'pending': {
        class: 'status-pending',
        icon: 'fa-clock',
        message: 'Your order is currently under review by our team.'
    },
    'approved': {
        class: 'status-approved',
        icon: 'fa-check-circle',
        message: 'Your order has been approved and will start production soon.'
    },
    'in-progress': {
        class: 'status-in-progress',
        icon: 'fa-tools',
        message: 'Your order is currently being crafted.'
    },
    'needs-clarification': {
        class: 'status-needs-clarification',
        icon: 'fa-exclamation-circle',
        message: 'We need additional information. Please respond to the message.'
    },
    'rejected': {
        class: 'status-rejected',
        icon: 'fa-times-circle',
        message: 'This order could not be processed. Contact support for details.'
    },
    'completed': {
        class: 'status-completed',
        icon: 'fa-check-circle',
        message: 'Your order has been completed and is ready for pickup/delivery.'
    }
};