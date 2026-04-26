import { useEffect, useState } from 'react';
import {
  Table, Button, Modal, Form, Input, Select, InputNumber, Space, Popconfirm, Tag, Typography, App, Row, Col,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { tasksApi, type CreateTaskDto } from '../api/tasks.api';
import { projectsApi } from '../api/projects.api';
import { usersApi } from '../api/users.api';
import type { Task, Project, User } from '../types';

const { Title } = Typography;

const priorityColor: Record<string, string> = {
  LOW: 'default',
  MEDIUM: 'blue',
  HIGH: 'orange',
  URGENT: 'red',
};

export default function Tasks() {
  const { message } = App.useApp();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filterProject, setFilterProject] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [form] = Form.useForm();

  useEffect(() => { loadProjects(); loadUsers(); }, []);
  useEffect(() => { load(); }, [page, filterProject]);

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

  const load = async () => {
    setLoading(true);
    try {
      const res = await tasksApi.findAll({ page, limit: 10, projectId: filterProject });
      setTasks(res.data.data);
      setTotal(res.data.total);
    } catch {
      message.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditTask(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (t: Task) => {
    setEditTask(t);
    form.setFieldsValue({
      taskName: t.taskName,
      description: t.description,
      projectId: t.projectId,
      estimatedHours: t.estimatedHours,
      status: t.status,
      priority: t.priority,
      assignedUserId: t.assignedUserId,
      clickUpTaskId: t.clickUpTaskId,
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values: CreateTaskDto = await form.validateFields();
      if (editTask) {
        await tasksApi.update(editTask.id, values);
        message.success('Task updated');
      } else {
        await tasksApi.create(values);
        message.success('Task created');
      }
      setModalOpen(false);
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      if (msg) message.error(msg);
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    setUpdatingStatus(id);
    try {
      await tasksApi.update(id, { status });
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: status as Task['status'] } : t)));
      message.success('Status updated');
    } catch {
      message.error('Failed to update status');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await tasksApi.delete(id);
      message.success('Task deleted');
      load();
    } catch {
      message.error('Failed to delete task');
    }
  };

  const columns = [
    { title: 'Task Name', dataIndex: 'taskName', width: 180 },
    {
      title: 'Project',
      dataIndex: ['project', 'projectName'],
      render: (v: string | undefined) => v ?? '—',
      width: 140,
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      width: 100,
      render: (v: string | null) =>
        v ? <Tag color={priorityColor[v]}>{v}</Tag> : '—',
    },
    {
      title: 'Assigned To',
      dataIndex: ['assignedUser', 'fullName'],
      width: 140,
      render: (v: string | undefined) => v ?? '—',
    },
    { title: 'Description', dataIndex: 'description', render: (v: string | null) => v ?? '—' },
    {
      title: 'Est. Hours',
      dataIndex: 'estimatedHours',
      width: 100,
      render: (v: number | null) => v ?? '—',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 150,
      render: (v: string, record: Task) => (
        <Select
          value={v}
          size="small"
          style={{ width: 130 }}
          loading={updatingStatus === record.id}
          onChange={(newStatus) => handleStatusChange(record.id, newStatus)}
          options={[
            { value: 'TODO', label: <Tag color="blue">TODO</Tag> },
            { value: 'IN_PROGRESS', label: <Tag color="processing">IN PROGRESS</Tag> },
            { value: 'DONE', label: <Tag color="success">DONE</Tag> },
            { value: 'CANCELLED', label: <Tag color="default">CANCELLED</Tag> },
          ]}
        />
      ),
    },
    {
      title: 'Actions',
      width: 100,
      render: (_: unknown, record: Task) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          <Popconfirm title="Delete task?" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0 }}>Tasks</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>New Task</Button>
      </div>

      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Select
            placeholder="Filter by project"
            style={{ width: '100%' }}
            allowClear
            value={filterProject}
            onChange={(v) => { setFilterProject(v); setPage(1); }}
            options={projects.map((p) => ({ value: p.id, label: p.projectName }))}
          />
        </Col>
      </Row>

      <Table
        dataSource={tasks}
        columns={columns}
        rowKey="id"
        loading={loading}
        scroll={{ x: 900 }}
        pagination={{ current: page, total, pageSize: 10, onChange: setPage }}
      />

      <Modal
        title={editTask ? 'Edit Task' : 'New Task'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        okText={editTask ? 'Save' : 'Create'}
        destroyOnHidden
        width={560}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="taskName" label="Task Name" rules={[{ required: true }]}>
            <Input placeholder="Enter task name" />
          </Form.Item>
          <Form.Item name="projectId" label="Project" rules={[{ required: true }]}>
            <Select
              placeholder="Select project"
              options={projects.map((p) => ({ value: p.id, label: p.projectName }))}
            />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="priority" label="Priority">
                <Select
                  placeholder="Select priority"
                  allowClear
                  options={[
                    { value: 'LOW', label: <Tag color="default">LOW</Tag> },
                    { value: 'MEDIUM', label: <Tag color="blue">MEDIUM</Tag> },
                    { value: 'HIGH', label: <Tag color="orange">HIGH</Tag> },
                    { value: 'URGENT', label: <Tag color="red">URGENT</Tag> },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="assignedUserId" label="Assigned To">
                <Select
                  placeholder="Select user"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  options={users.map((u) => ({ value: u.id, label: u.fullName }))}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="estimatedHours" label="Estimated Hours">
                <InputNumber min={0} step={0.5} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label="Status" initialValue="TODO">
                <Select
                  options={['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED'].map((s) => ({ value: s, label: s }))}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="clickUpTaskId" label="ClickUp Task ID">
            <Input placeholder="e.g. abc123xyz" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
