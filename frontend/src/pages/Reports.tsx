import { useEffect, useState } from 'react';
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
  Select,
  Modal,
  Segmented,
  Popconfirm,
} from 'antd';
import { EyeOutlined, BellOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { reportsApi } from '../api/reports.api';
import { usersApi } from '../api/users.api';
import { timeEntriesApi } from '../api/timeEntries.api';
import { notificationsApi } from '../api/notifications.api';
import type { TimeEntry, User } from '../types';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

type AnomalyData = {
  longEntries?: unknown[];
  draftEntries?: unknown[];
  overlaps?: unknown[];
  missingDays?: unknown[];
};

type GitGapRow = {
  userId: string;
  fullName: string;
  commitDays: number;
  entryDays: number;
  gapDays: number;
  gaps: { date: string; commitCount: number }[];
};

function formatMinutes(m: number) {
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

const statusColor: Record<string, string> = {
  DRAFT: 'default',
  SUBMITTED: 'processing',
  APPROVED: 'success',
  REJECTED: 'error',
};

export default function Reports() {
  const { message } = App.useApp();
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().startOf('month'), dayjs().endOf('month')]);
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>();
  const [users, setUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState('by-employee');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<unknown[]>([]);
  const [anomalyData, setAnomalyData] = useState<AnomalyData>({});
  const [gitGapData, setGitGapData] = useState<GitGapRow[]>([]);
  const [expandedGap, setExpandedGap] = useState<string[]>([]);
  const [reminding, setReminding] = useState(false);
  const [remindingUser, setRemindingUser] = useState<Record<string, boolean>>({});

  // Drill-down
  const [drillTitle, setDrillTitle] = useState('');
  const [drillEntries, setDrillEntries] = useState<TimeEntry[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);
  const [drillOpen, setDrillOpen] = useState(false);
  const [drillView, setDrillView] = useState<'entries' | 'daily'>('entries');

  useEffect(() => {
    usersApi.findAll({ limit: 100 }).then((res) => setUsers(res.data.data)).catch(() => {});
  }, []);

  useEffect(() => {
    loadReport(activeTab);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, selectedUserId, activeTab]);

  const getFilters = () => ({
    from: range[0].format('YYYY-MM-DD'),
    to: range[1].format('YYYY-MM-DD'),
    ...(selectedUserId && { userId: selectedUserId }),
  });

  const loadReport = async (tab: string) => {
    setLoading(true);
    setData([]);
    setAnomalyData({});
    setGitGapData([]);
    try {
      const filters = getFilters();
      if (tab === 'anomalies') {
        const res = await reportsApi.anomalies(filters);
        setAnomalyData(res.data as AnomalyData);
      } else if (tab === 'git-gaps') {
        const res = await reportsApi.gitGaps(filters);
        setGitGapData(res.data as GitGapRow[]);
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

  const handleSendReminders = async () => {
    setReminding(true);
    try {
      const res = await notificationsApi.sendReminders(
        range[0].format('YYYY-MM-DD'),
        range[1].format('YYYY-MM-DD'),
      );
      if (res.data.sent === 0) {
        message.info('כל העובדים דיווחו שעות בתקופה זו');
      } else {
        message.success(`נשלחו ${res.data.sent} תזכורות: ${res.data.employees.join(', ')}`);
      }
    } catch {
      message.error('Failed to send reminders');
    } finally {
      setReminding(false);
    }
  };

  const handleRemindUser = async (userId: string, fullName: string, date: string) => {
    const key = `${userId}-${date}`;
    setRemindingUser((prev) => ({ ...prev, [key]: true }));
    try {
      await notificationsApi.sendReminderToUser(userId, date);
      message.success(`תזכורת נשלחה ל-${fullName}`);
    } catch {
      message.error('שגיאה בשליחת תזכורת');
    } finally {
      setRemindingUser((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    setData([]);
    setAnomalyData({});
  };

  const openDrill = async (title: string, params: { userId?: string; projectId?: string }) => {
    setDrillTitle(title);
    setDrillOpen(true);
    setDrillView('entries');
    setDrillLoading(true);
    try {
      const res = await timeEntriesApi.findAll({
        limit: 200,
        from: range?.[0].format('YYYY-MM-DD'),
        to: range?.[1].format('YYYY-MM-DD'),
        ...params,
      });
      setDrillEntries(res.data.data);
    } catch {
      message.error('Failed to load entries');
    } finally {
      setDrillLoading(false);
    }
  };

  const drillColumns = [
    { title: 'Date', dataIndex: 'date', width: 100, render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
    { title: 'Employee', dataIndex: ['user', 'fullName'], width: 140 },
    { title: 'Project', dataIndex: ['project', 'projectName'], width: 140 },
    { title: 'Task', dataIndex: ['task', 'taskName'], width: 140, render: (v: string | undefined) => v ?? '—' },
    { title: 'Duration', dataIndex: 'durationMinutes', width: 90, render: (v: number) => formatMinutes(v) },
    { title: 'Status', dataIndex: 'status', width: 100, render: (v: string) => <Tag color={statusColor[v]}>{v}</Tag> },
  ];

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
    {
      title: '',
      width: 60,
      render: (_: unknown, record: Record<string, unknown>) => (
        <Button
          size="small"
          icon={<EyeOutlined />}
          onClick={(e) => { e.stopPropagation(); openDrill(`${record.fullName as string} — entries`, { userId: record.userId as string }); }}
        />
      ),
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
    {
      title: 'Employees',
      dataIndex: 'employees',
      render: (emps: (string | { fullName: string })[]) =>
        emps?.length
          ? emps.map((e) => {
              const name = typeof e === 'string' ? e : e.fullName;
              return <Tag key={name}>{name}</Tag>;
            })
          : '—',
    },
    {
      title: 'Tasks & Hours',
      dataIndex: 'taskBreakdown',
      render: (tasks: { taskName: string; totalMinutes: number }[]) =>
        tasks?.length
          ? tasks.map((t) => (
              <Tag key={t.taskName} style={{ marginBottom: 2 }}>
                {t.taskName} — {formatMinutes(t.totalMinutes)}
              </Tag>
            ))
          : '—',
    },
    {
      title: '',
      width: 60,
      render: (_: unknown, record: Record<string, unknown>) => (
        <Button
          size="small"
          icon={<EyeOutlined />}
          onClick={(e) => { e.stopPropagation(); openDrill(`${record.projectName as string} — entries`, { projectId: record.projectId as string }); }}
        />
      ),
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
      title: 'Employee Hours',
      dataIndex: 'employees',
      render: (emps: { fullName: string; minutes: number }[]) =>
        emps?.length
          ? emps.map((e) => (
              <Tag key={e.fullName} style={{ marginBottom: 2 }}>
                {e.fullName} — {formatMinutes(e.minutes)}
              </Tag>
            ))
          : '—',
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
      render: (emps: { fullName: string; minutes: number }[]) =>
        emps?.length
          ? emps.map((e) => (
              <Tag key={e.fullName}>{e.fullName} ({formatMinutes(e.minutes)})</Tag>
            ))
          : '—',
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
          onRow={(record) => ({
            onClick: () => openDrill(`${(record as Record<string, unknown>).fullName as string} — entries`, { userId: (record as Record<string, unknown>).userId as string }),
            style: { cursor: 'pointer' },
          })}
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
          onRow={(record) => ({
            onClick: () => openDrill(`${(record as Record<string, unknown>).projectName as string} — entries`, { projectId: (record as Record<string, unknown>).projectId as string }),
            style: { cursor: 'pointer' },
          })}
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
      key: 'git-gaps',
      label: 'Git Activity',
      children: (
        <div>
          <div style={{ marginBottom: 12, fontSize: 12, color: '#888' }}>
            ימים שבהם נמצאו git commits אבל אין דיווח שעות — לפי עובד.
            {gitGapData.length === 0 && !loading && (
              <span style={{ marginLeft: 8 }}>
                {' '}(אין נתוני commits מסונכרנים — הרץ Sync בדף Integrations)
              </span>
            )}
          </div>
          <Table
            dataSource={gitGapData}
            rowKey="userId"
            loading={loading}
            pagination={false}
            size="small"
            expandable={{
              expandedRowKeys: expandedGap,
              onExpand: (expanded, record) =>
                setExpandedGap(expanded ? [record.userId] : []),
              expandedRowRender: (record) => (
                <Table
                  dataSource={record.gaps}
                  rowKey="date"
                  size="small"
                  pagination={false}
                  columns={[
                    { title: 'Date', dataIndex: 'date', width: 130, render: (v: string) => dayjs(v).format('dddd DD/MM/YYYY') },
                    { title: 'Commits', dataIndex: 'commitCount', width: 100 },
                    { title: 'Time Entries', render: () => <Tag color="error">Missing</Tag>, width: 120 },
                  ]}
                  style={{ marginLeft: 0 }}
                />
              ),
            }}
            columns={[
              { title: 'Employee', dataIndex: 'fullName', width: 180 },
              { title: 'Commit Days', dataIndex: 'commitDays', width: 120,
                render: (v: number) => <Tag color="blue">{v} days</Tag> },
              { title: 'Entry Days', dataIndex: 'entryDays', width: 120,
                render: (v: number) => <Tag color="success">{v} days</Tag> },
              { title: 'Gap Days', dataIndex: 'gapDays', width: 120,
                render: (v: number) => v > 0
                  ? <Tag color="error">{v} days missing</Tag>
                  : <Tag color="success">No gaps</Tag>,
              },
              { title: 'Coverage', width: 120,
                render: (_: unknown, r: GitGapRow) => {
                  const pct = r.commitDays > 0
                    ? Math.round(((r.commitDays - r.gapDays) / r.commitDays) * 100)
                    : 100;
                  return <span style={{ color: pct < 80 ? '#ff4d4f' : '#52c41a', fontWeight: 600 }}>{pct}%</span>;
                },
              },
            ]}
          />
        </div>
      ),
    },
    {
      key: 'anomalies',
      label: 'Anomalies',
      children: (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Card size="small" title={<Text strong>דיווחים ארוכים מדי (&gt;8h)</Text>}>
            <Table
              dataSource={(anomalyData?.longEntries ?? []) as Record<string, unknown>[]}
              rowKey="entryId"
              loading={loading}
              pagination={false}
              size="small"
              columns={[
                { title: 'Employee', dataIndex: 'fullName', width: 160 },
                { title: 'Date', dataIndex: 'date', width: 110, render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
                { title: 'Duration', dataIndex: 'durationMinutes', width: 100, render: (v: number) => formatMinutes(v) },
                { title: 'Project', dataIndex: 'projectName', width: 160 },
                { title: 'Task', dataIndex: 'taskName', render: (v: string | null) => v ?? '—' },
              ]}
            />
          </Card>
          <Card size="small" title={<Text strong>דיווחים חסרים (טיוטה — לא נשלחו לאישור)</Text>}>
            <Table
              dataSource={(anomalyData?.draftEntries ?? []) as Record<string, unknown>[]}
              rowKey="entryId"
              loading={loading}
              pagination={false}
              size="small"
              columns={[
                { title: 'Employee', dataIndex: 'fullName', width: 160 },
                { title: 'Date', dataIndex: 'date', width: 110, render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
                { title: 'Duration', dataIndex: 'durationMinutes', width: 100, render: (v: number) => formatMinutes(v) },
                { title: 'Project', dataIndex: 'projectName', width: 160 },
                { title: 'Task', dataIndex: 'taskName', render: (v: string | null) => v ?? '—' },
              ]}
            />
          </Card>
          <Card
            size="small"
            title={<Text strong>ימים ללא דיווח</Text>}
            extra={
              <Popconfirm
                title="שלח תזכורות?"
                description={`שלח notification לכל עובד שלא דיווח שעות בין ${range[0].format('DD/MM/YYYY')} ל-${range[1].format('DD/MM/YYYY')}`}
                onConfirm={handleSendReminders}
                okText="שלח"
                cancelText="ביטול"
              >
                <Button
                  size="small"
                  icon={<BellOutlined />}
                  loading={reminding}
                  type="primary"
                  ghost
                >
                  Send Reminders
                </Button>
              </Popconfirm>
            }
          >
            <Table
              dataSource={(anomalyData?.missingDays ?? []) as Record<string, unknown>[]}
              rowKey={(r) => `${(r as { userId: string }).userId}-${(r as { date: string }).date}`}
              loading={loading}
              pagination={false}
              size="small"
              columns={[
                { title: 'Employee', dataIndex: 'fullName', width: 160 },
                { title: 'Date', dataIndex: 'date', render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
                {
                  title: '',
                  key: 'action',
                  width: 100,
                  render: (_: unknown, r: Record<string, unknown>) => {
                    const key = `${r.userId as string}-${r.date as string}`;
                    return (
                      <Button
                        size="small"
                        icon={<BellOutlined />}
                        loading={remindingUser[key]}
                        onClick={() => handleRemindUser(r.userId as string, r.fullName as string, dayjs(r.date as string).format('DD/MM/YYYY'))}
                      >
                        Remind
                      </Button>
                    );
                  },
                },
              ]}
            />
          </Card>
          <Card size="small" title={<Text strong>חפיפות בין דיווחים</Text>}>
            <Table
              dataSource={(anomalyData?.overlaps ?? []) as Record<string, unknown>[]}
              rowKey={(r) => `${(r as { entry1Id: string }).entry1Id}-${(r as { entry2Id: string }).entry2Id}`}
              loading={loading}
              pagination={false}
              size="small"
              columns={[
                { title: 'Employee', dataIndex: 'fullName', width: 160 },
                { title: 'Date', dataIndex: 'date', width: 110, render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
                { title: 'Entry 1', key: 'e1', width: 130, render: (_: unknown, r: Record<string, unknown>) => `${dayjs(r.start1 as string).format('HH:mm')} – ${dayjs(r.end1 as string).format('HH:mm')}` },
                { title: 'Entry 2', key: 'e2', width: 130, render: (_: unknown, r: Record<string, unknown>) => `${dayjs(r.start2 as string).format('HH:mm')} – ${dayjs(r.end2 as string).format('HH:mm')}` },
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

      <Row gutter={[12, 8]} style={{ marginBottom: 20 }} align="middle">
        <Col>
          <Space size={4}>
            <Button size="small" onClick={() => setRange([dayjs().startOf('day'), dayjs().endOf('day')])}>Today</Button>
            <Button size="small" onClick={() => setRange([dayjs().startOf('week'), dayjs().endOf('week')])}>This Week</Button>
            <Button size="small" onClick={() => setRange([dayjs().startOf('month'), dayjs().endOf('month')])}>This Month</Button>
          </Space>
        </Col>
        <Col>
          <RangePicker
            value={range}
            onChange={(v) => { if (v?.[0] && v?.[1]) setRange([v[0], v[1]]); }}
          />
        </Col>
        <Col>
          <Select
            placeholder="All employees"
            allowClear
            showSearch
            optionFilterProp="label"
            style={{ width: 200 }}
            value={selectedUserId}
            onChange={(v) => setSelectedUserId(v)}
            options={users.map((u) => ({ value: u.id, label: u.fullName }))}
          />
        </Col>
      </Row>

      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
        items={tabItems}
        destroyInactiveTabPane
      />

      {/* Drill-down modal */}
      <Modal
        title={drillTitle}
        open={drillOpen}
        onCancel={() => setDrillOpen(false)}
        footer={null}
        width={860}
        destroyOnHidden
      >
        <Segmented
          value={drillView}
          onChange={(v) => setDrillView(v as 'entries' | 'daily')}
          options={[
            { label: 'All Entries', value: 'entries' },
            { label: 'Daily Summary', value: 'daily' },
          ]}
          style={{ marginBottom: 16 }}
        />

        {drillView === 'entries' ? (
          <Table
            dataSource={drillEntries}
            columns={drillColumns}
            rowKey="id"
            loading={drillLoading}
            size="small"
            scroll={{ x: 700 }}
            pagination={{ pageSize: 20, showTotal: (t) => `${t} entries` }}
          />
        ) : (
          <Table
            loading={drillLoading}
            size="small"
            pagination={false}
            rowKey="date"
            dataSource={Object.values(
              drillEntries.reduce<Record<string, { date: string; totalMinutes: number; entryCount: number; projects: Set<string> }>>(
                (acc, e) => {
                  const d = dayjs(e.date).format('YYYY-MM-DD');
                  if (!acc[d]) acc[d] = { date: d, totalMinutes: 0, entryCount: 0, projects: new Set() };
                  acc[d].totalMinutes += e.durationMinutes;
                  acc[d].entryCount += 1;
                  if (e.project?.projectName) acc[d].projects.add(e.project.projectName);
                  return acc;
                },
                {},
              ),
            ).sort((a, b) => a.date.localeCompare(b.date))}
            columns={[
              {
                title: 'Date',
                dataIndex: 'date',
                width: 120,
                render: (v: string) => dayjs(v).format('DD/MM/YYYY'),
              },
              {
                title: 'Total Hours',
                dataIndex: 'totalMinutes',
                width: 120,
                render: (v: number) => formatMinutes(v),
              },
              { title: 'Entries', dataIndex: 'entryCount', width: 80 },
              {
                title: 'Projects',
                dataIndex: 'projects',
                render: (v: Set<string>) =>
                  [...v].map((p) => <Tag key={p}>{p}</Tag>),
              },
            ]}
          />
        )}
      </Modal>
    </div>
  );
}
