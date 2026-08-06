import React from 'react';

export interface FaqQuestion {
  question: string;
  answer: string;
}

export interface FaqSchemaProps {
  questions: FaqQuestion[];
}

const FaqSchema: React.FC<FaqSchemaProps> = ({ questions }) => {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: questions.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
};

export default FaqSchema;
