import React from 'react';

export interface SchemaType {
  '@context': string;
  '@type': string;
  [key: string]: unknown;
}

export interface SeoSchemaProps {
  schemas: SchemaType | SchemaType[];
}

const SeoSchema: React.FC<SeoSchemaProps> = ({ schemas }) => {
  const schemaArray = Array.isArray(schemas) ? schemas : [schemas];

  return (
    <>
      {schemaArray.map((schema, index) => (
        <script
          key={`schema-${index}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
    </>
  );
};

export default SeoSchema;
