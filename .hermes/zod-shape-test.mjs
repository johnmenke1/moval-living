import { z } from 'zod'
const s = z.object({
  state: z.string().length(2),
  zip: z.string().regex(/^\d{5}$/),
  description: z.string().min(50),
})
const result = s.safeParse({ state: 'CA', zip: 'abc', description: 'short' })
if (!result.success) {
  console.log('error.issues exists:', !!result.error.issues, '(length:', result.error.issues?.length, ')')
  console.log('error.errors exists:', !!result.error.errors)
  console.log('issue[0] sample:', JSON.stringify(result.error.issues[0], null, 2))
  console.log('issue[0] keys:', Object.keys(result.error.issues[0]).join(','))
  console.log('message of issue[0]:', result.error.issues[0].message)
  console.log('path of issue[0]:', JSON.stringify(result.error.issues[0].path))
}
