import { useEffect, useState } from 'react';
import {
  Table, Button, Modal, Form, Input, Select, Space, Popconfirm, Tag, Typography, App,
} from 'antd';
import { PlusOutlined, EditOutlined, StopOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { usersApi, type CreateUserDto, type UpdateUserDto } from '../api/users.api';
import { useAuthStore } from '../store/auth.store';
import type { User } from '../types';

const { Title } = Typography;

const roleColor: Record<string, string> = {
  EMPLOYEE: 'blue',
  MANAGER: 'orange',
  ADMIN: 'red',
};

export default function Users() {
  const { message } = App.useApp();
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role === 'ADMIN';
  const [users, setUsers] = useState<User[]>([]);
  const [managers, setManagers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [createRole, setCreateRole] = useState('EMPLOYEE');
  const [editRole, setEditRole] = useState('EMPLOYEE');

  const load = async () => {
    setLoading(true);
    try {
      const res = await usersApi.findAll({ page, limit: 10 });
      setUsers(res.data.data);
      setTotal(res.data.total);
    } catch {
      message.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const loadManagers = async () => {
    try {
      const res = await usersApi.findAll({ limit: 100 });
      setManagers(res.data.data.filter((u) => u.role === 'MANAGER'));
    } catch { /* ignore */ }
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [page]);
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { if (isAdmin) loadManagers(); }, []);

  const handleCreate = async () => {
    try {
      const values: CreateUserDto = await createForm.validateFields();
      await usersApi.create(values);
      message.success('User created');
      setCreateOpen(false);
      createForm.resetFields();
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      if (msg) message.error(msg);
    }
  };

  const openEdit = (u: User) => {
    setEditUser(u);
    setEditRole(u.role);
    editForm.setFieldsValue({ fullName: u.fullName, role: u.role, team: u.team, managerId: u.managerId });
    setEditOpen(true);
  };

  const handleEdit = async () => {
    try {
      const values: UpdateUserDto = await editForm.validateFields();
      await usersApi.update(editUser!.id, values);
      message.success('User updated');
      setEditOpen(false);
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      if (msg) message.error(msg);
    }
  };

  const handleDeactivate = async (id: string) => {
    try {
      await usersApi.deactivate(id);
      message.success('User deactivated');
      load();
    } catch {
      message.error('Failed to deactivate user');
    }
  };

  const columns = [
    { title: 'Full Name', dataIndex: 'fullName', width: 180 },
    { title: 'Email', dataIndex: 'email', width: 200 },
    {
      title: 'Role',
      dataIndex: 'role',
      width: 100,
      render: (v: string) => <Tag color={roleColor[v]}>{v}</Tag>,
    },
    { title: 'Team', dataIndex: 'team', width: 120, render: (v: string | null) => v ?? '—' },
    {
      title: 'Manager',
      dataIndex: 'managerId',
      width: 150,
      render: (v: string | null) => {
        const mgr = managers.find((m) => m.id === v);
        return mgr ? mgr.fullName : '—';
      },
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      width: 90,
      render: (v: boolean) => <Tag color={v ? 'success' : 'default'}>{v ? 'Active' : 'Inactive'}</Tag>,
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      width: 120,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY'),
    },
    ...( isAdmin ? [{
      title: 'Actions',
      width: 120,
      render: (_: unknown, record: User) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          {record.isActive && (
            <Popconfirm title="Deactivate user?" onConfirm={() => handleDeactivate(record.id)}>
              <Button size="small" danger icon={<StopOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    }] : []),
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0 }}>{isAdmin ? 'Users' : 'My Team'}</Title>
        {isAdmin && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            New User
          </Button>
        )}
      </div>

      <Table
        dataSource={users}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ current: page, total, pageSize: 10, onChange: setPage }}
        scroll={{ x: 800 }}
      />

      {isAdmin && <>
        <Modal
          title="Create New User"
          open={createOpen}
          onOk={handleCreate}
          onCancel={() => { setCreateOpen(false); createForm.resetFields(); setCreateRole('EMPLOYEE'); }}
          okText="Create"
          destroyOnHidden
        >
          <Form form={createForm} layout="vertical" style={{ marginTop: 16 }}>
            <Form.Item name="fullName" label="Full Name" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="email" label="Email" rules={[{ required: true }, { type: 'email' }]}>
              <Input />
            </Form.Item>
            <Form.Item name="password" label="Password" rules={[{ required: true, min: 6 }]}>
              <Input.Password />
            </Form.Item>
            <Form.Item name="role" label="Role" initialValue="EMPLOYEE" rules={[{ required: true }]}>
              <Select
                options={['EMPLOYEE', 'MANAGER', 'ADMIN'].map((r) => ({ value: r, label: r }))}
                onChange={(v) => { setCreateRole(v); if (v !== 'EMPLOYEE') createForm.setFieldValue('managerId', undefined); }}
              />
            </Form.Item>
            {createRole === 'EMPLOYEE' && (
              <Form.Item name="managerId" label="Manager">
                <Select
                  allowClear
                  placeholder="Select manager"
                  options={managers.map((m) => ({ value: m.id, label: m.fullName }))}
                />
              </Form.Item>
            )}
          </Form>
        </Modal>

        <Modal
          title="Edit User"
          open={editOpen}
          onOk={handleEdit}
          onCancel={() => setEditOpen(false)}
          okText="Save"
          destroyOnHidden
        >
          <Form form={editForm} layout="vertical" style={{ marginTop: 16 }}>
            <Form.Item name="fullName" label="Full Name" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="role" label="Role" rules={[{ required: true }]}>
              <Select
                options={['EMPLOYEE', 'MANAGER', 'ADMIN'].map((r) => ({ value: r, label: r }))}
                onChange={(v) => { setEditRole(v); if (v !== 'EMPLOYEE') editForm.setFieldValue('managerId', null); }}
              />
            </Form.Item>
            {editRole === 'EMPLOYEE' && (
              <Form.Item name="managerId" label="Manager">
                <Select
                  allowClear
                  placeholder="Select manager"
                  options={managers.map((m) => ({ value: m.id, label: m.fullName }))}
                />
              </Form.Item>
            )}
            <Form.Item name="team" label="Team">
              <Input placeholder="e.g. Backend, Frontend" />
            </Form.Item>
          </Form>
        </Modal>
      </>}
    </div>
  );
}
