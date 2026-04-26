import { useState } from 'react';
import {
  Tabs,
  Table,
  DatePicker,
  Button,
  Row,
  Col,
  Typography,
  Tag,
  Space,
  Card,
  App,
} from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { reportsApi } from '../api/reports.api';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

type AnomalyData = {
  longEntries?: unknown[];
  overlaps?: unknown[];
  missingDays?: unknown[];
};

function formatMinutes(m: number) {
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export default function Reports() {
  const { message } = App.useApp();
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [activeTab, setActiveTab] = useState('by-employee');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<unknown[]>([]);
  const [anomalyData, setAnomalyData] = useState<AnomalyData>({});

  const getFilters = () => ({
    from: range?.[0].format('YYYY-MM-DD'),
    to: range?.[1].format('YYYY-MM-DD'),
  });

  const loadReport = async (tab: string) => {
    setLoading(true);
    setData([]);
    setAnomalyData({});
    try {
      const filters = getFilters();
      if (tab === 'anomalies') {
        const res = await reportsApi.anomalies(filters);
        setAnomalyData(res.data as AnomalyData);
      } else {
        let res;
        if (tab === 'by-employee') res = await reportsApi.byEmployee(filters);
        else if (tab === 'by-project') res = await reportsApi.byProject(filters);
        else if (tab === 'by-task') res = await reportsApi.byTask(filters);
        else res = await reportsApi.daily(filters);
        setData((res.data as unknown[]) ?? []);
      }
    } catch {
      message.error('Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    setData([]);
    setAnomalyData({});
  };

  const handleSearch = () => loadReport(activeTab);

  const byEmployeeColumns = [
    { title: 'Employee', dataIndex: 'fullName', width: 180 },
    { title: 'Team', dataIndex: 'team', render: (v: string | null) => v ?? '—', width: 120 },
    {
      title: 'Total Hours',
      dataIndex: 'totalMinutes',
      render: (v: number) => formatMinutes(v),
      width: 120,
    },
    { title: 'Entries', dataIndex: 'entryCount', width: 80 },
    {
      title: 'Active Projects',
      dataIndex: 'activeProjects',
      render: (v: string[]) =>
        v?.length ? v.map((p) => <Tag key={p}>{p}</Tag>) : '—',
    },
  ];

  const byProjectColumns = [
    { title: 'Project', dataIndex: 'projectName', width: 200 },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 100,
      render: (v: string) => <Tag color={v === 'ACTIVE' ? 'success' : 'default'}>{v}</Tag>,
    },
    {
      title: 'Total Hours',
      dataIndex: 'totalMinutes',
      render: (v: number) => formatMinutes(v),
      width: 120,
    },
    { title: 'Entries', dataIndex: 'entryCount', width: 80 },
    { title: 'Employees', dataIndex: 'employeeCount', width: 100 },
    {
      title: 'Top Tasks',
      dataIndex: 'topTasks',
      render: (tasks: string[]) =>
        tasks?.length ? tasks.map((t) => <Tag key={t}>{t}</Tag>) : '—',
    },
  ];

  const byTaskColumns = [
    { title: 'Task', dataIndex: 'taskName', width: 200 },
    {
      title: 'Project',
      dataIndex: 'projectName',
      width: 180,
      render: (v: string | undefined) => v ?? '—',
    },
    {
      title: 'Total Hours',
      dataIndex: 'totalMinutes',
      render: (v: number) => formatMinutes(v),
      width: 120,
    },
    { title: 'Entries', dataIndex: 'entryCount', width: 80 },
    {
      title: 'Last Date',
      dataIndex: 'lastDate',
      width: 120,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: 'Employees',
      dataIndex: 'employees',
      render: (emps: { fullName: string }[]) =>
        emps?.map((e) => <Tag key={e.fullName}>{e.fullName}</Tag>),
    },
  ];

  const dailyColumns = [
    {
      title: 'Date',
      dataIndex: 'date',
      width: 120,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: 'Total Hours',
      dataIndex: 'totalMinutes',
      render: (v: number) => formatMinutes(v),
      width: 120,
    },
    { title: 'Entries', dataIndex: 'entryCount', width: 80 },
    {
      title: 'Employees',
      dataIndex: 'employees',
      render: (emps: { fullName: string; totalMinutes: number }[]) =>
        emps?.map((e) => (
          <Tag key={e.fullName}>{e.fullName} ({formatMinutes(e.totalMinutes)})</Tag>
        )),
    },
  ];


  const tabItems = [
    {
      key: 'by-employee',
      label: 'By Employee',
      children: (
        <Table
          dataSource={data as Record<string, unknown>[]}
          columns={byEmployeeColumns}
          rowKey="userId"
          loading={loading}
          pagination={false}
          size="small"
          scroll={{ x: 700 }}
        />
      ),
    },
    {
      key: 'by-project',
      label: 'By Project',
      children: (
        <Table
          dataSource={data as Record<string, unknown>[]}
          columns={byProjectColumns}
          rowKey="projectId"
          loading={loading}
          pagination={false}
          size="small"
          scroll={{ x: 700 }}
        />
      ),
    },
    {
      key: 'by-task',
      label: 'By Task',
      children: (
        <Table
          dataSource={data as Record<string, unknown>[]}
          columns={byTaskColumns}
          rowKey="taskId"
          loading={loading}
          pagination={false}
          size="small"
          scroll={{ x: 700 }}
        />
      ),
    },
    {
      key: 'daily',
      label: 'Daily',
      children: (
        <Table
          dataSource={data as Record<string, unknown>[]}
          columns={dailyColumns}
          rowKey="date"
          loading={loading}
          pagination={false}
          size="small"
          scroll={{ x: 600 }}
        />
      ),
    },
    {
      key: 'anomalies',
      label: 'Anomalies',
      children: (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Card size="small" title={<Text strong>Long Entries (&gt;8h)</Text>}>
            <Table
              dataSource={(anomalyData?.longEntries ?? []) as Record<string, unknown>[]}
              rowKey="id"
              loading={loading}
              pagination={false}
              size="small"
              columns={[
                { title: 'Employee', dataIndex: 'fullName' },
                { title: 'Date', dataIndex: 'date', render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
                { title: 'Duration', dataIndex: 'durationMinutes', render: (v: number) => formatMinutes(v) },
                { title: 'Project', dataIndex: 'projectName' },
                { title: 'Task', dataIndex: 'taskName' },
              ]}
            />
          </Card>
          <Card size="small" title={<Text strong>Missing Days (no entries)</Text>}>
            <Table
              dataSource={(anomalyData?.missingDays ?? []) as Record<string, unknown>[]}
              rowKey={(r) => `${(r as { userId: string }).userId}-${(r as { date: string }).date}`}
              loading={loading}
              pagination={false}
              size="small"
              columns={[
                { title: 'Employee', dataIndex: 'fullName' },
                { title: 'Date', dataIndex: 'date', render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
              ]}
            />
          </Card>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={4} style={{ marginTop: 0, marginBottom: 20 }}>Reports</Title>

      <Row gutter={12} style={{ marginBottom: 20 }} align="middle">
        <Col>
          <RangePicker
            value={range}
            onChange={(v) => setRange(v as [Dayjs, Dayjs] | null)}
          />
        </Col>
        <Col>
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
            Generate Report
          </Button>
        </Col>
      </Row>

      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
        items={tabItems}
      />
    </div>
  );
}
