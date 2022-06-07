import express, { Request, Response } from "express";
import { Category, CategoryModel } from "../models/category.js";
import { ClubModel } from "../models/club.js";
import { UserModel } from "../models/user.js";

async function getClubs(req: Request, res: Response) {
  try {
    await ClubModel.find()
      .populate("admin", "name userName age mail photoURL")
      .populate("category")
      .sort("-createdAt")
      .then(async (clubs) => {
        res.status(200).send(clubs);
      })
      .catch((error) => {
        res.status(400).send({ message: `Error get all clubs: ${error}` });
      });
  } catch (e) {
    res.status(500).send({ message: `Server error: ${e}` });
  }
}

async function getClub(req: Request, res: Response) {
  try {
    const { idClub } = req.params;
    await ClubModel.findById(idClub)
      .populate("usersList", "name userName age mail photoURL")
      .populate("admin", "name userName age mail photoURL")
      .populate("category")
      .then((club) => {
        if (club) {
          return res.status(200).send(club);
        }
        res.status(400).send({ message: `Club '${idClub}' not found` });
      })
      .catch((error) => {
        res
          .status(400)
          .send({ message: `Error get club '${idClub}': ${error}` });
      });
  } catch (e) {
    res.status(500).send({ message: `Server error: ${e}` });
  }
}

async function newClub(req: Request, res: Response) {
  try {
    const { clubName, idAdmin, description, category } = req.body;

    if (await ClubModel.findOne({ name: clubName })) {
      return res
        .status(406)
        .send({ message: "Club name already in the system." });
    }

    const adminUser = await UserModel.findById(idAdmin)
      .then((user) => {
        if (!user) {
          return res.status(404).send({ message: "User not found." });
        }
        return user;
      })
      .catch((error) => {
        return res.status(400).send({ message: `Error post club: ${error}` });
      });

    const categories: Category[] | null = await CategoryModel.find({
      name: category.split(","),
    });

    const newClub = new ClubModel({
      name: clubName,
      description: description,
      admin: adminUser,
      usersList: [adminUser],
      category: categories,
    });
    const club = await newClub.save();

    await UserModel.findOneAndUpdate(
      { _id: idAdmin },
      { $addToSet: { clubs: club } }
    )
      .then((resUser) => {
        if (!resUser) {
          return res.status(404).send({ message: "Error add user to club." });
        }
        res
          .status(200).send(club);
      })
      .catch((error) => {
        res.status(400).send({ message: `Error subscribe to club ${error}` });
      });
  } catch (e) {
    res.status(500).send({ message: `Server error: ${e}` });
  }
}

async function deleteClub(req: Request, res: Response) {
  try {
    const { idClub } = req.params;
    await ClubModel.findByIdAndDelete(idClub)
      .then((club) => {
        if (club) {
          UserModel.updateMany(
            { _id: club.usersList, disabled: false },
            { $pull: { clubs: club._id } },
            { safe: true }
          ).catch((error) => {
            res
              .status(500)
              .send({ message: `Error deleting user from the club ${error}` });
          });
          return res.status(200).send({ message: "Deleted!" });
        }
        res.status(404).send({ message: "The club doesn't exist!" });
      })
      .catch((error) => {
        res.status(400).send({ message: `Error delete club ${error}` });
      });
  } catch (e) {
    res.status(500).send({ message: `Server error: ${e}` });
  }
}

async function subscribeUserClub(req: Request, res: Response) {
  try {
    const { idUser, idClub } = req.body;
    const club = await ClubModel.findById(idClub);
    const user = await UserModel.findById(idUser);
    if (!club || !user) {
      return res
        .status(404)
        .send({ message: `Club ${idClub} or user ${idUser} not found` });
    }

    await ClubModel.findOneAndUpdate(
      { _id: club.id },
      { $addToSet: { usersList: user } }
    )
      .then((resClub) => {
        if (!resClub) {
          return res.status(404).send({ message: "Error add user to club." });
        }
      })
      .catch((error) => {
        return res
          .status(400)
          .send({ message: `Error subscribe to club ${error}` });
      });

    await UserModel.findOneAndUpdate(
      { _id: user.id },
      { $addToSet: { clubs: club } }
    )
      .then((resUser) => {
        if (!resUser) {
          return res.status(404).send({ message: "Error add user to club." });
        }
        res.status(200).send({
          message: `User ${user.name} is now subscribed to ${club.name}`,
        });
      })
      .catch((error) => {
        res.status(400).send({ message: `Error subscribe to club ${error}` });
      });
  } catch (e) {
    res.status(500).send({ message: `Server error: ${e}` });
  }
}

async function unsubscribeUserClub(req: Request, res: Response) {
  try {
    const { idUser, idClub } = req.body;

    await ClubModel.findOneAndUpdate(
      { _id: idClub },
      { $pull: { usersList: idUser } },
      { safe: true }
    )
      .then((club) => {
        if (!club) {
          return res.status(404).send({ message: "Club not found" });
        }
      })
      .catch((error) => {
        return res
          .status(400)
          .send({ message: `Error unsubscribe to club ${error}` });
      });

    await UserModel.findOneAndUpdate(
      { _id: idUser },
      { $pull: { clubs: idClub } },
      { safe: true }
    )
      .then((user) => {
        if (!user) {
          return res.status(404).send({ message: "User not found" });
        }
        res
          .status(200)
          .send({ message: `User ${user.name} stop follow club ${idClub}` });
      })
      .catch((error) => {
        res.status(400).send({ message: `Error unsubscribe to club ${error}` });
      });
  } catch (e) {
    res.status(500).send({ message: `Server error: ${e}` });
  }
}

async function updateClub(req: Request, res: Response) {
  try {
    const { idClub } = req.params;
    const { name, description } = req.body;

    await ClubModel.findByIdAndUpdate(idClub, { name: name, description: description }).then(clubUpdate => {
      if (clubUpdate == null) {
        return res.status(404).send({ message: "Club not found" });
      }
      res.status(200).send({ message: "Updated" });
    }).catch(error => {
      res.status(400).send({ message: `Error unsubscribe to club ${error}` });
    });
  } catch (e) {
    res.status(500).send({ message: `Server error: ${e}` });
  }
}

let router = express.Router();

router.get("/", getClubs);
router.get("/:idClub", getClub);
router.post("/", newClub);
router.delete("/:idClub", deleteClub);
router.put("/", subscribeUserClub);
router.put("/unsubscribe", unsubscribeUserClub);
router.put("/:idClub", updateClub);
export default router;
