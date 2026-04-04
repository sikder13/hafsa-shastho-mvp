const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Exclude supabase edge functions from Metro bundler
config.resolver.blockList = [/supabase\/functions\/.*/];

module.exports = config;
