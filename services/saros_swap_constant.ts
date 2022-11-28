import BN from 'bn.js';

export const TRADING_FEE_NUMERATOR = new BN(25); // For LP
export const TRADING_FEE_DENOMINATOR = new BN(10000);
export const OWNER_TRADING_FEE_NUMERATOR = new BN(5); // For Protocol
export const OWNER_TRADING_FEE_DENOMINATOR = new BN(10000);
export const OWNER_WITHDRAW_FEE_NUMERATOR = new BN(0); // For Protocol
export const OWNER_WITHDRAW_FEE_DENOMINATOR = new BN(0);
export const HOST_FEE_NUMERATOR = new BN(20); // For Partner
export const HOST_FEE_DENOMINATOR = new BN(100);
