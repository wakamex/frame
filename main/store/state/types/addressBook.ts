import { z } from 'zod'

export const AddressBookEntrySchema = z.object({
  address: z.string(),
  name: z.string(),
  notes: z.string().default(''),
  createdAt: z.number()
})

export type AddressBookEntry = z.infer<typeof AddressBookEntrySchema>
