'use client';

import React from 'react';
import { Applicant } from '../lib/types';

interface InvestorsPageProps {
  applicants: Applicant[];
  applicantsLoading: boolean;
}

const InvestorsPage: React.FC<InvestorsPageProps> = ({ applicants, applicantsLoading }) => {
  return (
    <div className="space-y-6 max-w-screen-2xl mx-auto pb-12">
      {/* Empty page - content removed */}
    </div>
  );
};

export default InvestorsPage;




