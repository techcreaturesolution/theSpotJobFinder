export const needsProfile = (user) => user?.role === 'user' && !user.profileComplete;
