export const formatTime = (d) => (d ? new Date(d).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '');
export const formatDay = (d) => (d ? new Date(d).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }) : '');
