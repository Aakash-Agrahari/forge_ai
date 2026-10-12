import prisma from "./src/config/prisma.js";

const projectId = "cmtlhdwfm00050s934f42n6mb";

const files = await prisma.projectFile.findMany({
    where: {
        projectId
    },
    orderBy: {
        createdAt: "desc"
    },
    select: {
        id: true,
        path: true,
        content: true,
        createdAt: true,
        updatedAt: true
    }
});

console.log(JSON.stringify(files, null, 2));

await prisma.$disconnect();
