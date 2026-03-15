import React from 'react';
import { Application, Bundle } from '../types';
import ExecutiveDashboard from './dashboard/ExecutiveDashboard';

interface DashboardProps {
  applications: Application[];
  bundles: Bundle[];
}

const Dashboard: React.FC<DashboardProps> = ({ applications = [], bundles = [] }) => (
  <ExecutiveDashboard applications={applications} bundles={bundles} />
);

export default Dashboard;
