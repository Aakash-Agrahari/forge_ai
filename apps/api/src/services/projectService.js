import prisma from "../config/prisma.js";

export async function createProject({
    userId,
    name,
    description
}) {
    return prisma.project.create({
        data: {
            name,
            description,
            userId
        },
        select: {
            id: true,
            name: true,
            description: true,
            createdAt: true,
            updatedAt: true
        }
    });
}

export async function getUserProjects(userId) {
    return prisma.project.findMany({
        where: {
            userId
        },
        orderBy: {
            updatedAt: "desc"
        },
        select: {
            id: true,
            name: true,
            description: true,
            createdAt: true,
            updatedAt: true
        }
    });
}