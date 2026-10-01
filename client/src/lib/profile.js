export const needsProfile = (user) => ['user', 'employer'].includes(user?.role) && !user.profileComplete;
