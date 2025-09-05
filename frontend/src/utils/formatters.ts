export const formatCurrency = (amount: number): string => {
  return `₹ ${amount.toLocaleString('en-IN')}`;
};

export const formatDate = (date: string): string => {
  return new Date(date).toLocaleDateString('en-IN');
};

export const generateTaskSerial = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 1000);
  return `TSK-${year}${month}${day}-${random}`;
};

export const getTodayDate = (): string => {
  return new Date().toISOString().split('T')[0];
};