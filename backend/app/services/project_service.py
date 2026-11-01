import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import BadRequestError, ConflictError, NotFoundError
from app.models.enums import ProjectRole
from app.models.member import ProjectMember
from app.models.project import Project
from app.models.user import User
from app.schemas.project import ProjectCreate, ProjectUpdate
from app.services import auth_service


async def create_project(db: AsyncSession, user: User, project_in: ProjectCreate) -> Project:
    project = Project(
        name=project_in.name,
        description=project_in.description,
        created_by_id=user.id,
    )
    db.add(project)
    await db.flush()

    # Creator becomes OWNER
    owner_member = ProjectMember(
        project_id=project.id,
        user_id=user.id,
        role=ProjectRole.OWNER,
    )
    db.add(owner_member)
    await db.flush()
    await db.refresh(project)
    return project


async def list_user_projects(db: AsyncSession, user: User) -> list[tuple[Project, ProjectRole]]:
    query = (
        select(Project, ProjectMember.role)
        .join(ProjectMember, Project.id == ProjectMember.project_id)
        .where(ProjectMember.user_id == user.id)
        .order_by(Project.created_at.desc())
    )
    result = await db.execute(query)
    return [(row[0], row[1]) for row in result.all()]


async def get_project_by_id(db: AsyncSession, project_id: uuid.UUID) -> Project | None:
    query = select(Project).where(Project.id == project_id)
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def get_project_with_members(db: AsyncSession, project_id: uuid.UUID) -> Project | None:
    query = (
        select(Project)
        .options(selectinload(Project.members).selectinload(ProjectMember.user))
        .where(Project.id == project_id)
    )
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def update_project(db: AsyncSession, project: Project, project_in: ProjectUpdate) -> Project:
    if project_in.name is not None:
        project.name = project_in.name
    if project_in.description is not None:
        project.description = project_in.description
    await db.flush()
    await db.refresh(project)
    return project


async def delete_project(db: AsyncSession, project: Project) -> None:
    await db.delete(project)
    await db.flush()


async def get_project_member(
    db: AsyncSession, project_id: uuid.UUID, user_id: uuid.UUID
) -> ProjectMember | None:
    query = (
        select(ProjectMember)
        .options(selectinload(ProjectMember.user))
        .where(ProjectMember.project_id == project_id, ProjectMember.user_id == user_id)
    )
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def list_project_members(db: AsyncSession, project_id: uuid.UUID) -> list[ProjectMember]:
    query = (
        select(ProjectMember)
        .options(selectinload(ProjectMember.user))
        .where(ProjectMember.project_id == project_id)
        .order_by(ProjectMember.created_at.asc())
    )
    result = await db.execute(query)
    return list(result.scalars().all())


async def add_project_member(
    db: AsyncSession,
    project_id: uuid.UUID,
    email: str,
    role: ProjectRole,
) -> ProjectMember:
    target_user = await auth_service.get_user_by_email(db, email)
    if not target_user:
        raise NotFoundError(message=f"User with email '{email}' does not exist.")

    existing_member = await get_project_member(db, project_id, target_user.id)
    if existing_member:
        raise ConflictError(message=f"User '{email}' is already a member of this project.")

    member = ProjectMember(
        project_id=project_id,
        user_id=target_user.id,
        role=role,
    )
    db.add(member)
    await db.flush()
    await db.refresh(member)
    # Eagerly attach user
    member.user = target_user
    return member


async def update_project_member_role(
    db: AsyncSession,
    member: ProjectMember,
    new_role: ProjectRole,
) -> ProjectMember:
    if member.role == ProjectRole.OWNER and new_role != ProjectRole.OWNER:
        # Check if another owner exists
        query = select(ProjectMember).where(
            ProjectMember.project_id == member.project_id,
            ProjectMember.role == ProjectRole.OWNER,
            ProjectMember.id != member.id,
        )
        result = await db.execute(query)
        other_owner = result.scalar_one_or_none()
        if not other_owner:
            raise BadRequestError(message="Cannot downgrade the sole owner of a project.")

    member.role = new_role
    await db.flush()
    await db.refresh(member)
    return member


async def remove_project_member(db: AsyncSession, member: ProjectMember) -> None:
    if member.role == ProjectRole.OWNER:
        # Ensure there is at least one other owner
        query = select(ProjectMember).where(
            ProjectMember.project_id == member.project_id,
            ProjectMember.role == ProjectRole.OWNER,
            ProjectMember.id != member.id,
        )
        result = await db.execute(query)
        other_owner = result.scalar_one_or_none()
        if not other_owner:
            raise BadRequestError(message="Cannot remove the sole owner of a project.")

    await db.delete(member)
    await db.flush()
