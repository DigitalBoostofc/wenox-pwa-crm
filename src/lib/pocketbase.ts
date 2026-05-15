import PocketBase from 'pocketbase';

const url = import.meta.env.VITE_PB_URL ?? 'https://api.wenox.com.br';

export const pb = new PocketBase(url);

pb.autoCancellation(false);
