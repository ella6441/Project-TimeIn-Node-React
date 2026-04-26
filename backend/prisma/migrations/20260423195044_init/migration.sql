BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[User] (
    [id] NVARCHAR(1000) NOT NULL,
    [fullName] NVARCHAR(1000) NOT NULL,
    [email] NVARCHAR(1000) NOT NULL,
    [password] NVARCHAR(1000) NOT NULL,
    [role] NVARCHAR(1000) NOT NULL CONSTRAINT [User_role_df] DEFAULT 'EMPLOYEE',
    [team] NVARCHAR(1000),
    [isActive] BIT NOT NULL CONSTRAINT [User_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [User_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [User_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [User_email_key] UNIQUE NONCLUSTERED ([email])
);

-- CreateTable
CREATE TABLE [dbo].[Project] (
    [id] NVARCHAR(1000) NOT NULL,
    [projectName] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [Project_status_df] DEFAULT 'ACTIVE',
    [managerId] NVARCHAR(1000),
    [externalClickUpListId] NVARCHAR(1000),
    [gitRepositoryUrl] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Project_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Project_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Task] (
    [id] NVARCHAR(1000) NOT NULL,
    [taskName] NVARCHAR(1000) NOT NULL,
    [description] NVARCHAR(1000),
    [projectId] NVARCHAR(1000) NOT NULL,
    [assignedUserId] NVARCHAR(1000),
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [Task_status_df] DEFAULT 'TODO',
    [priority] NVARCHAR(1000) NOT NULL CONSTRAINT [Task_priority_df] DEFAULT 'MEDIUM',
    [clickUpTaskId] NVARCHAR(1000),
    [estimatedHours] FLOAT(53),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Task_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Task_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[TimeEntry] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [projectId] NVARCHAR(1000) NOT NULL,
    [taskId] NVARCHAR(1000) NOT NULL,
    [date] DATETIME2 NOT NULL,
    [startTime] DATETIME2 NOT NULL,
    [endTime] DATETIME2 NOT NULL,
    [durationMinutes] INT NOT NULL,
    [workType] NVARCHAR(1000) NOT NULL CONSTRAINT [TimeEntry_workType_df] DEFAULT 'DEVELOPMENT',
    [description] NVARCHAR(1000),
    [source] NVARCHAR(1000) NOT NULL CONSTRAINT [TimeEntry_source_df] DEFAULT 'MANUAL',
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [TimeEntry_status_df] DEFAULT 'DRAFT',
    [relatedCommitHash] NVARCHAR(1000),
    [relatedClickUpTaskId] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [TimeEntry_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [TimeEntry_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- AddForeignKey
ALTER TABLE [dbo].[Project] ADD CONSTRAINT [Project_managerId_fkey] FOREIGN KEY ([managerId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Task] ADD CONSTRAINT [Task_projectId_fkey] FOREIGN KEY ([projectId]) REFERENCES [dbo].[Project]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Task] ADD CONSTRAINT [Task_assignedUserId_fkey] FOREIGN KEY ([assignedUserId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[TimeEntry] ADD CONSTRAINT [TimeEntry_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[TimeEntry] ADD CONSTRAINT [TimeEntry_projectId_fkey] FOREIGN KEY ([projectId]) REFERENCES [dbo].[Project]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[TimeEntry] ADD CONSTRAINT [TimeEntry_taskId_fkey] FOREIGN KEY ([taskId]) REFERENCES [dbo].[Task]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
