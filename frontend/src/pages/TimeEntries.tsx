import { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Select,
  DatePicker,
  TimePicker,
  Input,
  InputNumber,
  Segmented,
  App,
  Popconfirm,
  Row,
  Col,
  Typography,
  List,
  Card,
  Badge,
} from 'antd';
import { PlusOutlined, CopyOutlined, DeleteOutlined, CheckOutlined, CloseOutlined, DownloadOutlined, BulbOutlined, BranchesOutlined, ApiOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { timeEntriesApi, type CreateTimeEntryDto, type TimeEntrySuggestion } from '../api/timeEntries.api';
import { projectsApi } from '../api/projects.api';
import { tasksApi } from '../api/tasks.api';
import { usersApi } from '../api/users.api';
import { settingsApi } from '../api/settings.api';
import { integrationsApi } from '../api/integrations.api';
import type { ClickUpTask } from '../api/integrations.api';
import { useAuthStore } from '../store/auth.store';
import type { TimeEntry, Project, Task, User } from '../types';

const { Title } = Typography;
const { RangePicker } = DatePicker;

const statusColor: Record<string, string> = {
  DRAFT: 'default',
  SUBMITTED: 'processing',
  APPROVED: 'success',
  REJECTED: 'error',
};

const DEFAULT_WORK_TYPES = ['DEVELOPMENT', 'DESIGN', 'MEETINGS', 'REVIEW', 'TESTING', 'OTHER'];

function formatMinutes(m: number) {
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export default function TimeEntries() {
  const { message } = App.useApp();
  const user = useAuthStore((s) => s.user);
  const isManagerOrAdmin = user?.role === 'MANAGER' || user?.role === 'ADMIN';

  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<TimeEntry | null>(null);
  const [form] = Form.useForm();

  // Filters
  const [filterProject, setFilterProject] = useState<string | undefined>();
  const [filterStatus, setFilterStatus] = useState<string | undefined>();
  const [filterRange, setFilterRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [filterUser, setFilterUser] = useState<string | undefined>();
  const [filterTask, setFilterTask] = useState<string | undefined>();
  const [workTypes, setWorkTypes] = useState<string[]>(DEFAULT_WORK_TYPES);
  const [requireWorkType, setRequireWorkType] = useState(false);
  const [inputMode, setInputMode] = useState<'times' | 'duration'>('times');
  const [modalClickupTasks, setModalClickupTasks] = useState<ClickUpTask[]>([]);
  const [exporting, setExporting] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<TimeEntrySuggestion[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestDate, setSuggestDate] = useState<Dayjs>(dayjs());

  const loadSettings = async () => {
    try {
      const res = await settingsApi.findAll();
      const s: Record<string, string> = {};
      res.data.forEach((item) => { s[item.key] = item.value; });
      if (s['work_types']) {
        setWorkTypes(s['work_types'].split(',').map((t) => t.trim()).filter(Boolean));
      }
      setRequireWorkType(s['require_work_type'] === 'true');
    } catch { /* ignore */ }
  };

  const loadProjects = async () => {
    try {
      const res = await projectsApi.findAll({ limit: 100 });
      setProjects(res.data.data);
    } catch { /* ignore */ }
  };

  const loadUsers = async () => {
    try {
      const res = await usersApi.findAll({ limit: 100 });
      setUsers(res.data.data);
    } catch { /* ignore */ }
  };

  const loadAllTasks = async () => {
    try {
      const res = await tasksApi.findAll({ limit: 100, projectId: filterProject });
      setTasks(res.data.data);
    } catch { /* ignore */ }
  };

  const loadEntries = async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: 10,
        projectId: filterProject,
        status: filterStatus,
        from: filterRange?.[0].format('YYYY-MM-DD'),
        to: filterRange?.[1].format('YYYY-MM-DD'),
        ...(isManagerOrAdmin && filterUser && { userId: filterUser }),
        ...(isManagerOrAdmin && filterTask && { taskId: filterTask }),
      };
      const res = isManagerOrAdmin
        ? await timeEntriesApi.findAll(params)
        : await timeEntriesApi.findMine(params);
      setEntries(res.data.data);
      setTotal(res.data.total);
    } catch (err) {
      console.error('loadEntries error:', err);
      message.error('Failed to load entries');
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { loadProjects(); loadSettings(); if (isManagerOrAdmin) loadUsers(); }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { if (isManagerOrAdmin) loadAllTasks(); }, [filterProject]);
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { loadEntries(); }, [page, filterProject, filterStatus, filterRange, filterUser, filterTask]);

  const loadTasksForProject = async (projectId: string) => {
    try {
      const res = await tasksApi.findAll({ projectId, limit: 100 });
      setTasks(res.data.data);
    } catch {
      setTasks([]);
    }
  };

  const loadModalClickupTasks = async (projectId: string) => {
    try { const res = await integrationsApi.getClickUpTasks({ projectId, limit: 100 }); setModalClickupTasks(res.data.data); }
    catch { setModalClickupTasks([]); }
  };

  const openCreate = () => {
    setEditEntry(null);
    form.resetFields();
    setTasks([]);
    setModalClickupTasks([]);
    setInputMode('times');
    setModalOpen(true);
  };

  const openEdit = (entry: TimeEntry) => {
    setEditEntry(entry);
    loadTasksForProject(entry.projectId);
    loadModalClickupTasks(entry.projectId);
    form.setFieldsValue({
      projectId: entry.projectId,
      taskId: entry.taskId,
      date: dayjs(entry.date),
      startTime: dayjs(entry.startTime),
      endTime: dayjs(entry.endTime),
      workType: entry.workType,
      description: entry.description,
      relatedCommitHash: entry.relatedCommitHash,
      relatedClickUpTaskId: entry.relatedClickUpTaskId,
    });
    setModalOpen(true);
  };

  const handleSubmitModal = async () => {
    try {
      const values = await form.validateFields();
      const dateStr = values.date.format('YYYY-MM-DD');
      let startTimeStr: string;
      let endTimeStr: string;
      if (inputMode === 'duration') {
        const start = values.startTime as ReturnType<typeof dayjs>;
        const durationMins = Math.round((values.durationHours as number) * 60);
        const end = start.add(durationMins, 'minute');
        startTimeStr = `${dateStr}T${start.format('HH:mm:ss')}`;
        endTimeStr = `${dateStr}T${end.format('HH:mm:ss')}`;
      } else {
        if (!values.endTime.isAfter(values.startTime)) {
          message.error('End time must be after start time');
          return;
        }
        startTimeStr = `${dateStr}T${values.startTime.format('HH:mm:ss')}`;
        endTimeStr = `${dateStr}T${values.endTime.format('HH:mm:ss')}`;
      }
      const dto: CreateTimeEntryDto = {
        projectId: values.projectId,
        taskId: values.taskId,
        date: dateStr,
        startTime: startTimeStr,
        endTime: endTimeStr,
        workType: values.workType,
        description: values.description,
        relatedCommitHash: values.relatedCommitHash,
        relatedClickUpTaskId: values.relatedClickUpTaskId,
      };
      if (editEntry) {
        await timeEntriesApi.update(editEntry.id, dto);
        message.success('Entry updated');
      } else {
        await timeEntriesApi.create(dto);
        message.success('Entry created');
      }
      setModalOpen(false);
      loadEntries();
    } catch (err: unknown) {
      const raw = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
      const msg = Array.isArray(raw) ? (raw as string[])[0] : (raw as string | undefined);
      message.error(msg ?? 'Failed to save entry');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await timeEntriesApi.delete(id);
      message.success('Entry deleted');
      loadEntries();
    } catch {
      message.error('Failed to delete entry');
    }
  };

  const handleSubmitEntry = async (id: string) => {
    try {
      await timeEntriesApi.submit(id);
      message.success('Entry submitted for approval');
      loadEntries();
    } catch {
      message.error('Failed to submit entry');
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await timeEntriesApi.approve(id);
      message.success('Entry approved');
      loadEntries();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      message.error(msg ?? 'Failed to approve entry');
    }
  };

  const handleReject = async (id: string) => {
    try {
      await timeEntriesApi.reject(id);
      message.success('Entry rejected');
      loadEntries();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      message.error(msg ?? 'Failed to reject entry');
    }
  };

  const handleCopy = async (id: string) => {
    try {
      await timeEntriesApi.copy(id);
      message.success('Entry copied to today');
      loadEntries();
    } catch {
      message.error('Failed to copy entry');
    }
  };

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const baseParams = {
        projectId: filterProject,
        status: filterStatus,
        from: filterRange?.[0].format('YYYY-MM-DD'),
        to: filterRange?.[1].format('YYYY-MM-DD'),
        ...(isManagerOrAdmin && filterUser && { userId: filterUser }),
        ...(isManagerOrAdmin && filterTask && { taskId: filterTask }),
      };
      const fetchPage = (page: number) => isManagerOrAdmin
        ? timeEntriesApi.findAll({ ...baseParams, page, limit: 200 })
        : timeEntriesApi.findMine({ ...baseParams, page, limit: 200 });

      const first = await fetchPage(1);
      const { total } = first.data;
      const totalPages = Math.ceil(total / 200);
      const rest = totalPages > 1
        ? await Promise.all(Array.from({ length: totalPages - 1 }, (_, i) => fetchPage(i + 2)))
        : [];
      const rows = [first, ...rest].flatMap((r) => r.data.data);
      const headers = [
        'Date',
        ...(isManagerOrAdmin ? ['Employee'] : []),
        'Project', 'Task', 'Start', 'End', 'Duration (min)',
        'Work Type', 'Description', 'Status', 'Source',
        'Commit Hash', 'ClickUp Task ID',
      ];

      const csvRows = rows.map((e) =>
        [
          dayjs(e.date).format('DD/MM/YYYY'),
          ...(isManagerOrAdmin ? [e.user?.fullName ?? ''] : []),
          e.project?.projectName ?? '',
          e.task?.taskName ?? '',
          dayjs(e.startTime).format('HH:mm'),
          dayjs(e.endTime).format('HH:mm'),
          e.durationMinutes,
          e.workType,
          e.description ?? '',
          e.status,
          e.source,
          e.relatedCommitHash ?? '',
          e.relatedClickUpTaskId ?? '',
        ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','),
      );

      const csvContent = [headers.join(','), ...csvRows].join('\n');
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `time-entries-${dayjs().format('YYYY-MM-DD')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      message.error('Failed to export');
    } finally {
      setExporting(false);
    }
  };

  const loadSuggestions = async (date: Dayjs) => {
    setSuggestLoading(true);
    try {
      const res = await timeEntriesApi.getSuggestions(date.format('YYYY-MM-DD'));
      setSuggestions(res.data.suggestions);
    } catch {
      message.error('Failed to load suggestions');
    } finally {
      setSuggestLoading(false);
    }
  };

  const openSuggestions = () => {
    setSuggestOpen(true);
    loadSuggestions(suggestDate);
  };

  const applySuggestion = (s: TimeEntrySuggestion) => {
    setSuggestOpen(false);
    setEditEntry(null);
    form.resetFields();
    form.setFieldsValue({
      projectId: s.projectId ?? undefined,
      taskId: s.taskId ?? undefined,
      date: dayjs(s.date),
      description: s.description,
      workType: s.workType,
      relatedCommitHash: s.relatedCommitHash ?? undefined,
      relatedClickUpTaskId: s.relatedClickUpTaskId ?? undefined,
    });
    if (s.projectId) {
      tasksApi.findAll({ projectId: s.projectId, limit: 100 })
        .then((r) => setTasks(r.data.data))
        .catch(() => {});
    }
    setModalOpen(true);
  };

  const columns = [
    {
      title: 'Date',
      dataIndex: 'date',
      render: (v: string) => dayjs(v).format('DD/MM/YYYY'),
      width: 110,
    },
    ...(isManagerOrAdmin
      ? [{ title: 'Employee', dataIndex: ['user', 'fullName'], width: 140 }]
      : []),
    { title: 'Project', dataIndex: ['project', 'projectName'], width: 140 },
    { title: 'Task', dataIndex: ['task', 'taskName'], width: 140 },
    {
      title: 'Time',
      render: (_: unknown, r: TimeEntry) =>
        `${dayjs(r.startTime).format('HH:mm')} – ${dayjs(r.endTime).format('HH:mm')}`,
      width: 120,
    },
    {
      title: 'Duration',
      dataIndex: 'durationMinutes',
      render: (v: number) => formatMinutes(v),
      width: 90,
    },
    {
      title: 'Type',
      dataIndex: 'workType',
      width: 120,
    },
    {
      title: 'Source',
      dataIndex: 'source',
      width: 90,
      render: (v: string) => {
        const colors: Record<string, string> = { MANUAL: 'default', TIMER: 'blue', GIT: 'purple', CLICKUP: 'cyan' };
        return <Tag color={colors[v] ?? 'default'}>{v}</Tag>;
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (v: string) => <Tag color={statusColor[v]}>{v}</Tag>,
      width: 100,
    },
    {
      title: 'Actions',
      render: (_: unknown, record: TimeEntry) => (
        <Space size="small">
          {record.status === 'DRAFT' && record.userId === user?.id && (
            <>
              <Button size="small" onClick={() => openEdit(record)}>Edit</Button>
              <Popconfirm title="Submit for approval?" onConfirm={() => handleSubmitEntry(record.id)}>
                <Button size="small" type="primary">Submit</Button>
              </Popconfirm>
              <Popconfirm title="Delete this entry?" onConfirm={() => handleDelete(record.id)}>
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </>
          )}
          {record.status === 'SUBMITTED' && isManagerOrAdmin && (
            <>
              <Popconfirm title="Approve?" onConfirm={() => handleApprove(record.id)}>
                <Button size="small" type="primary" icon={<CheckOutlined />}>Approve</Button>
              </Popconfirm>
              <Popconfirm title="Reject?" onConfirm={() => handleReject(record.id)}>
                <Button size="small" danger icon={<CloseOutlined />}>Reject</Button>
              </Popconfirm>
            </>
          )}
          {record.status === 'REJECTED' && record.userId === user?.id && (
            <>
              <Button size="small" onClick={() => openEdit(record)}>Edit</Button>
              <Popconfirm title="Delete?" onConfirm={() => handleDelete(record.id)}>
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </>
          )}
          <Button size="small" icon={<CopyOutlined />} onClick={() => handleCopy(record.id)}>
            Copy
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0 }}>Time Entries</Title>
        <Space>
          <Button
            icon={<BulbOutlined />}
            onClick={openSuggestions}
          >
            Suggestions
          </Button>
          <Button
            icon={<DownloadOutlined />}
            loading={exporting}
            onClick={handleExportCsv}
          >
            Export CSV
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            New Entry
          </Button>
        </Space>
      </div>

      {/* Filters */}
      <Row gutter={[10, 8]} style={{ marginBottom: 16 }} wrap={false}>
        <Col flex="1">
          <Select
            placeholder="All projects"
            style={{ width: '100%' }}
            allowClear
            value={filterProject}
            onChange={(v) => { setFilterProject(v); setFilterTask(undefined); setPage(1); }}
            options={projects.map((p) => ({ value: p.id, label: p.projectName }))}
          />
        </Col>
        <Col flex="1">
          <Select
            placeholder="All statuses"
            style={{ width: '100%' }}
            allowClear
            value={filterStatus}
            onChange={(v) => { setFilterStatus(v); setPage(1); }}
            options={['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'].map((s) => ({ value: s, label: s }))}
          />
        </Col>
        {isManagerOrAdmin && (
          <>
            <Col flex="1">
              <Select
                placeholder="All employees"
                style={{ width: '100%' }}
                allowClear
                showSearch
                optionFilterProp="label"
                value={filterUser}
                onChange={(v) => { setFilterUser(v); setPage(1); }}
                options={users.map((u) => ({ value: u.id, label: u.fullName }))}
              />
            </Col>
            <Col flex="1">
              <Select
                placeholder="All tasks"
                style={{ width: '100%' }}
                allowClear
                showSearch
                optionFilterProp="label"
                value={filterTask}
                onChange={(v) => { setFilterTask(v); setPage(1); }}
                options={tasks.map((t) => ({ value: t.id, label: t.taskName }))}
              />
            </Col>
          </>
        )}
        <Col flex="none">
          <RangePicker
            value={filterRange}
            onChange={(v) => { setFilterRange(v as [Dayjs, Dayjs] | null); setPage(1); }}
          />
        </Col>
      </Row>

      <Table
        dataSource={entries}
        columns={columns}
        rowKey="id"
        loading={loading}
        size="small"
        scroll={{ x: 900 }}
        pagination={{
          current: page,
          total,
          pageSize: 10,
          onChange: setPage,
          showTotal: (t) => `${t} entries`,
        }}
      />

      {/* Create / Edit modal */}
      <Modal
        title={editEntry ? 'Edit Time Entry' : 'New Time Entry'}
        open={modalOpen}
        onOk={handleSubmitModal}
        onCancel={() => setModalOpen(false)}
        okText={editEntry ? 'Save' : 'Create'}
        width={540}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="projectId" label="Project" rules={[{ required: true }]}>
                <Select
                  placeholder="Select project"
                  options={projects.map((p) => ({ value: p.id, label: p.projectName }))}
                  onChange={(v) => {
                    form.setFieldValue('taskId', undefined);
                    form.setFieldValue('relatedClickUpTaskId', undefined);
                    loadTasksForProject(v);
                    loadModalClickupTasks(v);
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="taskId" label="Task" rules={[{ required: true }]}>
                <Select
                  placeholder="Select task"
                  options={tasks.map((t) => ({ value: t.id, label: t.taskName }))}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12} style={{ marginBottom: 8 }}>
            <Col span={24}>
              <Segmented
                value={inputMode}
                onChange={(v) => { setInputMode(v as 'times' | 'duration'); form.setFieldValue('endTime', undefined); form.setFieldValue('durationHours', undefined); }}
                options={[
                  { label: 'Start / End Time', value: 'times' },
                  { label: 'Duration', value: 'duration' },
                ]}
                block
              />
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="date" label="Date" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="startTime" label="Start" rules={[{ required: true }]}>
                <TimePicker format="HH:mm" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              {inputMode === 'times' ? (
                <Form.Item name="endTime" label="End" rules={[{ required: true }]}>
                  <TimePicker format="HH:mm" style={{ width: '100%' }} />
                </Form.Item>
              ) : (
                <Form.Item name="durationHours" label="Duration (h)" rules={[{ required: true, type: 'number', min: 0.1 }]}>
                  <InputNumber min={0.1} max={24} step={0.5} style={{ width: '100%' }} placeholder="e.g. 1.5" />
                </Form.Item>
              )}
            </Col>
          </Row>
          <Form.Item
            name="workType"
            label="Work Type"
            rules={requireWorkType ? [{ required: true, message: 'Work type is required' }] : []}
          >
            <Select
              options={workTypes.map((w) => ({ value: w, label: w }))}
              placeholder="Select type"
              allowClear={!requireWorkType}
            />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="What did you work on?" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="relatedCommitHash" label="Commit Hash">
                <Input placeholder="e.g. abc123f" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="relatedClickUpTaskId" label="ClickUp Task">
                {modalClickupTasks.length > 0 ? (
                  <Select
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    placeholder="Select ClickUp task"
                    options={modalClickupTasks.map((t) => ({ value: t.clickUpTaskId, label: `${t.taskName} (#${t.clickUpTaskId})` }))}
                  />
                ) : (
                  <Input placeholder="e.g. #abc123" />
                )}
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        title={
          <Space>
            <BulbOutlined style={{ color: '#faad14' }} />
            <span>הצעות אוטומטיות לדיווח</span>
          </Space>
        }
        open={suggestOpen}
        onCancel={() => setSuggestOpen(false)}
        footer={null}
        width={560}
      >
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13 }}>תאריך:</span>
          <DatePicker
            value={suggestDate}
            onChange={(d) => {
              if (d) {
                setSuggestDate(d);
                loadSuggestions(d);
              }
            }}
            format="DD/MM/YYYY"
            allowClear={false}
          />
          <Badge count={suggestions.length} style={{ backgroundColor: '#52c41a' }} />
        </div>
        <List
          loading={suggestLoading}
          dataSource={suggestions}
          locale={{ emptyText: 'אין הצעות לתאריך זה — ודא שיש לך tasks מוקצים או Git מסונכרן' }}
          renderItem={(s) => (
            <Card size="small" style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <Space direction="vertical" size={2} style={{ flex: 1, minWidth: 0 }}>
                  <Space wrap>
                    {s.source === 'GIT'
                      ? <Tag icon={<BranchesOutlined />} color="blue">Git</Tag>
                      : s.source === 'CLICKUP'
                        ? <Tag icon={<ApiOutlined />} color="purple">ClickUp</Tag>
                        : <Tag icon={<BulbOutlined />} color="orange">Task</Tag>
                    }
                    {s.projectName && <Tag>{s.projectName}</Tag>}
                    {s.taskName && <Tag color="green">{s.taskName}</Tag>}
                  </Space>
                  <div style={{ fontSize: 13 }}>{s.description}</div>
                  <div style={{ fontSize: 12, color: '#999' }}>
                    {s.durationMinutes} min
                    {s.relatedCommitHash && ` · ${s.relatedCommitHash.slice(0, 7)}`}
                    {s.relatedClickUpTaskId && ` · #${s.relatedClickUpTaskId}`}
                  </div>
                </Space>
                <Button type="primary" size="small" style={{ flexShrink: 0 }} onClick={() => applySuggestion(s)}>
                  + הוסף
                </Button>
              </div>
            </Card>
          )}
        />
      </Modal>
    </div>
  );
}
