import { AutoForm } from 'filigran-ui';
import { z } from 'zod';

const testSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  age: z.number().min(0, { message: 'Age must be positive.' }),
  birthdate: z.date(),
});

export const AutoFormTest = () => {
  const onSubmit = ( z.infer<typeof testSchema>) => {
    console.log('Submitted ', data);
  };

  return <AutoForm schema={testSchema} onSubmit={onSubmit} />;
};
