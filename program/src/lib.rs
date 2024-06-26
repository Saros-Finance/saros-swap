#![deny(missing_docs)]

//! An Uniswap-like program for the Solana blockchain.

pub mod constraints;
pub mod curve;
pub mod error;
pub mod instruction;
pub mod processor;
pub mod state;

#[cfg(not(feature = "no-entrypoint"))]
mod entrypoint;

// Export current sdk types for downstream users building with a different sdk version
pub use solana_program;

#[cfg(feature = "mainnet")]
solana_program::declare_id!("SSwapUtytfBdBn1b9NUGG6foMVPtcWgpRU32HToDUZr");

#[cfg(feature = "devnet")]
solana_program::declare_id!("SSStkgZHW17LRbGUFSDQqzZ4jMXpfmVxHDbWwMaFEXE");

#[cfg(all(not(feature = "mainnet"), not(feature = "devnet")))]
solana_program::declare_id!("StaGHXrozaggJ7a9Y8U5ak5NxxZgYVdrBG9kQwbHAes");
