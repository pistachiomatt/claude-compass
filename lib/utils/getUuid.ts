import { customAlphabet } from 'nanoid'

export const UUID_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz-.'
export const UUID_LENGTH = 16

const getUuid = () => {
  const gen = customAlphabet(UUID_ALPHABET, UUID_LENGTH)
  let slug = gen()
  // Exclude generated slugs that look like file extensions (2-4 chars after a dot)
  while (/\.[a-zA-Z0-9]{2,4}$/.test(slug)) {
    slug = gen()
  }
  return slug
}

export default getUuid
