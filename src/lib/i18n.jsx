import { createContext, useContext, useEffect, useState } from "react";

// Translation dictionary. Add new keys here as more of the app is translated.
// Structure: translations[key] = { en: "...", fr: "..." }
const translations = {
  // Navigation
  "nav.dashboard": { en: "Dashboard", fr: "Tableau de bord" },
  "nav.students": { en: "Students", fr: "Élèves" },
  "nav.classes": { en: "Classes", fr: "Classes" },
  "nav.staff": { en: "Staff", fr: "Personnel" },
  "nav.attendance": { en: "Attendance", fr: "Présences" },
  "nav.portfolio": { en: "Portfolio", fr: "Portfolio" },
  "nav.assessment": { en: "Assessment", fr: "Évaluation" },
  "nav.gradebook": { en: "Gradebook", fr: "Carnet de notes" },
  "nav.planning": { en: "Curriculum", fr: "Curriculum" },
  "nav.calendar": { en: "Calendar", fr: "Calendrier" },
  "calendar.subscribe": { en: "Add to my phone calendar", fr: "Ajouter à mon calendrier" },
  "calendar.subscribeIntroStaff": {
    en: "Link the school calendar to Google Calendar or your phone. You will see every event, including staff only dates, and new dates appear on their own.",
    fr: "Reliez le calendrier de l'école à Google Agenda ou à votre téléphone. Vous verrez tous les événements, y compris ceux réservés au personnel, et les nouvelles dates s'ajouteront automatiquement."
  },
  "calendar.subscribeIntroFamily": {
    en: "Link the school calendar to Google Calendar or your phone. New school dates will appear there on their own.",
    fr: "Reliez le calendrier de l'école à Google Agenda ou à votre téléphone. Les nouvelles dates de l'école s'y ajouteront automatiquement."
  },
  "calendar.subscribeGoogle": { en: "Add to Google Calendar", fr: "Ajouter à Google Agenda" },
  "calendar.subscribePhone": { en: "Add to iPhone or other calendar app", fr: "Ajouter à l'iPhone ou à une autre application d'agenda" },
  "calendar.subscribeCopy": { en: "Copy the link", fr: "Copier le lien" },
  "calendar.subscribeCopied": { en: "Link copied", fr: "Lien copié" },
  "calendar.subscribeNote": {
    en: "This link is private to the school. Please do not share it. Google Calendar can take a few hours to show changes.",
    fr: "Ce lien est privé. Merci de ne pas le partager. Google Agenda peut mettre quelques heures à afficher les modifications."
  },
  "calendar.subscribeError": {
    en: "The calendar link is not available yet. Please try again later.",
    fr: "Le lien du calendrier n'est pas encore disponible. Merci de réessayer plus tard."
  },
  "nav.canteen": { en: "Canteen", fr: "Cantine" },
  "nav.checkin": { en: "Staff check-in", fr: "Pointage du personnel" },
  "nav.incidents": { en: "Incidents", fr: "Incidents" },
  "nav.leave": { en: "Leave requests", fr: "Demandes de congé" },
  "nav.admissions": { en: "Admissions", fr: "Admissions" },
  "nav.assignments": { en: "Assignments", fr: "Devoirs" },
  "nav.timetable": { en: "Timetable", fr: "Emploi du temps" },
  "nav.standards": { en: "Standards", fr: "Standards" },
  "nav.reports": { en: "Reports", fr: "Bulletins" },
  "nav.behavior": { en: "Behavior", fr: "Comportement" },
  "nav.resources": { en: "Resources", fr: "Ressources" },
  "nav.accreditation": { en: "Accreditation", fr: "Accréditation" },
  "nav.billing": { en: "Billing", fr: "Facturation" },
  "nav.updates": { en: "Family Updates", fr: "Infos aux familles" },
  "nav.weekly": { en: "Weekly updates", fr: "Points hebdomadaires" },
  "nav.daily": { en: "Pre-N Diary", fr: "Journal Pre-N" },
  "nav.conferences": { en: "Conferences", fr: "Conférences" },
  "nav.more": { en: "More", fr: "Plus" },
  "nav.allSections": { en: "Explore", fr: "Explorer" },
  "nav.moreSectionsNote": {
    en: "",
    fr: ""
  },

  // Top bar
  "top.saving": { en: "Saving…", fr: "Enregistrement…" },
  "top.saved": { en: "Saved", fr: "Enregistré" },
  "top.loading": { en: "Loading…", fr: "Chargement…" },
  "top.notSaved": { en: "Not saved – tap to retry", fr: "Non enregistré – réessayer" },
  "top.notSavedHint": { en: "Your last change did not reach the school's database. Check your connection and tap to try again.", fr: "Votre dernière modification n'a pas été enregistrée. Vérifiez votre connexion et appuyez pour réessayer." },
  "top.menu": { en: "Menu", fr: "Menu" },
  "top.settings": { en: "Settings", fr: "Paramètres" },
  "top.language": { en: "Language", fr: "Langue" },

  // Common actions, used across many tabs
  "common.add": { en: "Add", fr: "Ajouter" },
  "common.edit": { en: "Edit", fr: "Modifier" },
  "common.remove": { en: "Remove", fr: "Retirer" },
  "common.delete": { en: "Delete", fr: "Supprimer" },
  "common.save": { en: "Save", fr: "Enregistrer" },
  "common.cancel": { en: "Cancel", fr: "Annuler" },
  "common.close": { en: "Close", fr: "Fermer" },
  "common.all": { en: "All", fr: "Tous" },
  "common.filterByGrade": { en: "Filter by grade", fr: "Filtrer par niveau" },
  "common.search": { en: "Search", fr: "Rechercher" },
  "common.attachAFile": { en: "Attach a file", fr: "Joindre un fichier" },
  "common.uploading": { en: "Uploading…", fr: "Téléversement…" },
  "common.name": { en: "Name", fr: "Nom" },
  "common.date": { en: "Date", fr: "Date" },
  "common.notes": { en: "Notes", fr: "Remarques" },
  "common.status": { en: "Status", fr: "Statut" },

  // Load error screen (shown to everyone if data fails to load)
  "loadError.title": { en: "Could not load your school's data", fr: "Impossible de charger les données de l'école" },
  "loadError.body": {
    en: "To protect your information, BrightSteps Hub will not show or save any changes until this is resolved. Please check your internet connection and reload the page. If this keeps happening, contact your administrator.",
    fr: "Pour protéger vos informations, BrightSteps Hub n'affichera ni n'enregistrera aucune modification tant que ce problème n'est pas résolu. Veuillez vérifier votre connexion internet et recharger la page. Si le problème persiste, contactez votre administrateur."
  },
  "loadError.reload": { en: "Reload", fr: "Recharger" },

  // Dashboard
  "dashboard.eyebrow": { en: "International School · Grand-Bassam", fr: "École internationale · Grand-Bassam" },

  // Portfolio tab
  "portfolio.title": { en: "Portfolio", fr: "Portfolio" },
  "portfolio.emptyStudents": { en: "Add students first, then log learning moments here.", fr: "Ajoutez d'abord des élèves, puis enregistrez ici les moments d'apprentissage." },
  "portfolio.studentReflection": { en: "Student reflection", fr: "Réflexion de l'élève" },
  "portfolio.teacherNote": { en: "Teacher note", fr: "Remarque de l'enseignant" },
  "portfolio.newEntry": { en: "New portfolio entry", fr: "Nouvelle entrée de portfolio" },
  "portfolio.entryType": { en: "Entry type", fr: "Type d'entrée" },
  "portfolio.student": { en: "Student", fr: "Élève" },
  "portfolio.chooseStudent": { en: "Choose a student", fr: "Choisissez un élève" },
  "portfolio.focusArea": { en: "Focus area", fr: "Domaine d'apprentissage" },
  "portfolio.whatStudentWrote": { en: "What the student wrote", fr: "Ce que l'élève a écrit" },
  "portfolio.whatDidTheyDo": { en: "What did they do or learn", fr: "Ce qu'il ou elle a fait ou appris" },
  "portfolio.placeholderStudentWords": { en: "In the student's own words", fr: "Avec les mots de l'élève" },
  "portfolio.placeholderLearningMoment": { en: "Describe the learning moment", fr: "Décrivez le moment d'apprentissage" },
  "portfolio.attachmentsOptional": { en: "Attachments (optional)", fr: "Pièces jointes (facultatif)" },
  "portfolio.saveEntry": { en: "Save entry", fr: "Enregistrer l'entrée" },
  "portfolio.errorChooseStudent": { en: "Please choose a student before saving.", fr: "Veuillez choisir un élève avant d'enregistrer." },
  "portfolio.errorAddNote": { en: "Please add a note before saving.", fr: "Veuillez ajouter une remarque avant d'enregistrer." },
  "portfolio.starterButton": { en: "Suggest a starter draft", fr: "Proposer un premier jet" },
  "portfolio.starterBusy": { en: "Writing a draft…", fr: "Rédaction en cours…" },
  "portfolio.starterNeedsNotes": { en: "Write a few quick words about what happened first.", fr: "Écrivez d'abord quelques mots sur ce qui s'est passé." },
  "portfolio.starterConfirm": { en: "Turn your notes into a starter draft? Your notes will be replaced by the draft.", fr: "Transformer vos notes en premier jet ? Vos notes seront remplacées par le texte proposé." },
  "portfolio.starterFailed": { en: "Couldn't make a draft.", fr: "Impossible de proposer un texte." },
  "portfolio.starterReview": { en: "Starter draft: read it and change anything that isn't quite right before saving.", fr: "Premier jet : relisez-le et corrigez ce qui ne convient pas avant d'enregistrer." },

  // Focus area tags, shared with Portfolio and other tabs
  "tag.Inquiry": { en: "Inquiry", fr: "Investigation" },
  "tag.Literacy": { en: "Literacy", fr: "Lecture-écriture" },
  "tag.Numeracy": { en: "Numeracy", fr: "Mathématiques" },
  "tag.Social Emotional": { en: "Social Emotional", fr: "Socio-émotionnel" },
  "tag.Creative Arts": { en: "Creative Arts", fr: "Arts créatifs" },
  "tag.Physical": { en: "Physical", fr: "Physique" },

  // Shared labels used on several parent-facing screens
  "common.allGrades": { en: "All grades", fr: "Tous les niveaux" },
  "common.wholeSchool": { en: "Whole school", fr: "Toute l'école" },
  "common.today": { en: "Today", fr: "Aujourd'hui" },
  "common.nextPrefix": { en: "Next:", fr: "Prochainement :" },
  "common.due": { en: "Due {date}", fr: "À rendre le {date}" },
  "common.dateRange": { en: "{start} to {end}", fr: "du {start} au {end}" },
  "common.filterByType": { en: "Filter by type", fr: "Filtrer par type" },
  "common.filterByCategory": { en: "Filter by category", fr: "Filtrer par catégorie" },
  "common.rubric": { en: "Rubric", fr: "Grille d'évaluation" },
  "common.optional": { en: "Optional", fr: "Facultatif" },
  "common.inLast7Days": { en: "{n} in the last 7 days", fr: "{n} au cours des 7 derniers jours" },

  // Dashboard (parent view)
  "dash.schoolDocuments": { en: "School documents", fr: "Documents de l'école" },
  "dash.signedOn": { en: "Signed on {date}", fr: "Signé le {date}" },
  "dash.readAndSign": { en: "Read and sign", fr: "Lire et signer" },
  "dash.noChildLinked": {
    en: "No child linked to your account yet. Please contact the school administrator.",
    fr: "Aucun enfant n'est encore associé à votre compte. Veuillez contacter l'administration de l'école."
  },
  "dash.toBeConfirmed": { en: "To be confirmed", fr: "À confirmer" },
  "dash.homeroomTeacher": { en: "Homeroom teacher", fr: "Enseignant(e) principal(e)" },
  "dash.learningAssistant": { en: "Learning assistant", fr: "Assistant(e) pédagogique" },
  "dash.allergies": { en: "Allergies:", fr: "Allergies :" },
  "dash.medical": { en: "Medical:", fr: "Informations médicales :" },
  "dash.attendanceFor": { en: "Attendance for {name}", fr: "Présences de {name}" },
  "dash.attendanceYear": {
    en: "{present} present · {absent} absent · {late} late this year",
    fr: "{present} présences · {absent} absences · {late} retards cette année"
  },
  "dash.attendanceCounts": {
    en: "{present} present · {absent} absent · {late} late",
    fr: "{present} présences · {absent} absences · {late} retards"
  },
  "dash.nextUp": { en: "Next up", fr: "À venir" },
  "dash.nothingScheduled": { en: "Nothing scheduled yet.", fr: "Aucun événement prévu pour l'instant." },
  "dash.familyUpdates": { en: "Family updates", fr: "Infos aux familles" },
  "dash.nothingPosted": { en: "Nothing posted yet.", fr: "Aucune publication pour l'instant." },
  "dash.announcements": { en: "School announcements", fr: "Annonces de l'école" },
  "dash.noAnnouncements": { en: "No announcements yet.", fr: "Aucune annonce pour l'instant." },
  "dash.seeAllAnnouncements": { en: "See all announcements", fr: "Voir toutes les annonces" },
  "dash.showFewerAnnouncements": { en: "Show fewer", fr: "Afficher moins" },
  "dash.audienceLower": { en: "Lower school", fr: "Maternelle et primaire" },
  "dash.audienceUpper": { en: "Upper school", fr: "Collège" },
  "dash.lunchMenu": { en: "Lunch menu", fr: "Menu de la cantine" },
  "dash.latestPortfolioChild": { en: "Latest portfolio entries for your child", fr: "Dernières entrées du portfolio de votre enfant" },
  "dash.noEntries": { en: "No entries yet.", fr: "Aucune entrée pour l'instant." },

  // Document signing (Dashboard and Resources)
  "sign.title": { en: "Sign: {title}", fr: "Signer : {title}" },
  "sign.intro": {
    en: "By signing below, you confirm you have read and understood this document.",
    fr: "En signant ci-dessous, vous confirmez avoir lu et compris ce document."
  },
  "sign.fullName": { en: "Your full name", fr: "Votre nom complet" },
  "sign.signature": { en: "Signature", fr: "Signature" },
  "sign.confirm": { en: "I confirm I have read and understood {title}.", fr: "Je confirme avoir lu et compris le document « {title} »." },
  "sign.submit": { en: "Submit signature", fr: "Envoyer ma signature" },
  "sign.errName": { en: "Please type your full name.", fr: "Veuillez saisir votre nom complet." },
  "sign.errSignature": { en: "Please sign in the box above.", fr: "Veuillez signer dans le champ ci-dessus." },
  "sign.errConfirm": {
    en: "Please confirm you've read the document before signing.",
    fr: "Veuillez confirmer avoir lu le document avant de signer."
  },
  "sign.padPlaceholder": { en: "Type your full name", fr: "Saisissez votre nom complet" },
  "sign.padHelp": { en: "Typing your name here counts as your signature.", fr: "La saisie de votre nom ici vaut signature." },

  // Tuition and fees card (parent Dashboard)
  "fees.title": { en: "Tuition & fees", fr: "Frais de scolarité" },
  "fees.totalDue": { en: "Total balance due", fr: "Solde total à régler" },
  "fees.credit": { en: "Credit on file", fr: "Avoir en votre faveur" },
  "fees.settled": { en: "Fully settled", fr: "Entièrement réglé" },
  "fees.noSchedule": {
    en: "No fee schedule set yet, contact the school office for details.",
    fr: "Aucun échéancier n'est encore défini. Contactez le secrétariat de l'école pour plus de détails."
  },
  "fees.registrationFee": { en: "Registration fee", fr: "Frais d'inscription" },
  "fees.cat.Registration": { en: "Registration", fr: "Inscription" },
  "fees.cat.Tuition": { en: "Tuition", fr: "Scolarité" },
  "fees.cat.Other": { en: "Other", fr: "Autres frais" },
  "fees.status.Paid in full": { en: "Paid in full", fr: "Payé en totalité" },
  "fees.status.Partially paid": { en: "Partially paid", fr: "Partiellement payé" },
  "fees.status.Not yet paid": { en: "Not yet paid", fr: "Pas encore payé" },
  "fees.status.Waived": { en: "Waived", fr: "Exonéré" },
  "fees.status.Payment received": { en: "Payment received", fr: "Paiement reçu" },
  "fees.status.No fee set": { en: "No fee set", fr: "Aucun frais défini" },
  "fees.realPriceWaived": { en: "Real price {price} · fully waived", fr: "Prix réel {price} · entièrement exonéré" },
  "fees.realPriceDiscount": { en: "Real price {price} · {discount} discount", fr: "Prix réel {price} · remise de {discount}" },
  "fees.paidOf": { en: "{paid} paid of {owed} owed", fr: "{paid} payés sur {owed} dus" },
  "fees.due": { en: "{amount} due", fr: "{amount} à régler" },
  "fees.history": { en: "Transaction history", fr: "Historique des transactions" },

  // My child (parent view of the Students tab)
  "child.title": { en: "My child", fr: "Mon enfant" },
  "child.upcomingFor": { en: "Upcoming for {grade}", fr: "À venir · {grade}" },
  "child.assignmentsDue": { en: "Assignments due", fr: "Devoirs à rendre" },
  "child.nothingAssigned": { en: "Nothing assigned right now.", fr: "Aucun devoir pour le moment." },
  "child.noPortfolio": { en: "No portfolio entries yet.", fr: "Aucune entrée de portfolio pour l'instant." },
  "child.assessments": { en: "Assessments", fr: "Évaluations" },
  "child.noAssessments": { en: "No assessments recorded yet.", fr: "Aucune évaluation enregistrée pour l'instant." },
  "child.noReports": { en: "No reports generated yet.", fr: "Aucun bulletin pour l'instant." },

  // Calendar (family view)
  "calendar.upcomingCount.one": { en: "{n} upcoming event", fr: "{n} événement à venir" },
  "calendar.upcomingCount.other": { en: "{n} upcoming events", fr: "{n} événements à venir" },
  "calendar.upcoming": { en: "Upcoming", fr: "À venir" },
  "calendar.past": { en: "Past", fr: "Passés" },
  "eventType.Academic": { en: "Academic", fr: "Scolaire" },
  "eventType.Holiday": { en: "Holiday", fr: "Congé" },
  "eventFilter.Holiday": { en: "Holidays & breaks", fr: "Congés et vacances" },
  "eventType.Break": { en: "Break", fr: "Vacances" },
  "eventType.Staff": { en: "Staff", fr: "Personnel" },
  "eventType.Event": { en: "Event", fr: "Événement" },
  "eventType.Meeting": { en: "Meeting", fr: "Réunion" },

  // Report cards (parent view of Reports)
  "reports.parentTitle": { en: "Report Cards", fr: "Bulletins" },
  "reports.emptyChild": {
    en: "No report cards have been generated for your child yet.",
    fr: "Aucun bulletin n'a encore été publié pour votre enfant."
  },
  "reports.kind.student": { en: "Student report", fr: "Bulletin" },
  "reports.kind.transcript": { en: "Transcript", fr: "Relevé de notes" },
  "reports.studentTitle": { en: "{name}'s report", fr: "Bulletin de {name}" },
  "reports.transcriptTitle": { en: "{name}'s transcript", fr: "Relevé de notes de {name}" },
  "reports.print": { en: "Print / Save as PDF", fr: "Imprimer / Enregistrer en PDF" },
  "reports.progressReport": { en: "Progress Report", fr: "Bulletin scolaire" },
  "reports.academicTranscript": { en: "Academic Transcript", fr: "Relevé de notes" },
  "reports.studentName": { en: "Student Name", fr: "Nom de l'élève" },
  "reports.grade": { en: "Grade", fr: "Niveau" },
  "reports.academicYear": { en: "Academic Year", fr: "Année scolaire" },
  "reports.period": { en: "Period", fr: "Période" },
  "reports.periodPrefix": { en: "Period:", fr: "Période :" },
  "reports.nationality": { en: "Nationality", fr: "Nationalité" },
  "reports.levelsLegend": { en: "Understanding Progress Levels", fr: "Comprendre les niveaux de progression" },
  "reports.legend.Emerging": { en: "Emerging – Beginning to explore and show early understanding", fr: "En émergence – Commence à explorer et à montrer une première compréhension" },
  "reports.legend.Developing": { en: "Developing – Growing and applying skills with support", fr: "En développement – Progresse et applique ses compétences avec de l'aide" },
  "reports.legend.Proficient": { en: "Proficient – Using skills consistently and independently", fr: "Maîtrisé – Utilise ses compétences de façon régulière et autonome" },
  "reports.legend.Confident": { en: "Confident – Applying skills confidently across situations", fr: "Assuré – Applique ses compétences avec assurance dans diverses situations" },
  "reports.gradesLegend": { en: "Understanding Grades", fr: "Comprendre les notes" },
  "reports.generated": { en: "Generated {date}", fr: "Généré le {date}" },
  "reports.attendanceLine": {
    en: "{present} present · {absent} absent · {late} late during this period",
    fr: "{present} présences · {absent} absences · {late} retards sur la période"
  },
  "reports.grades": { en: "Grades", fr: "Notes" },
  "reports.noGrades": { en: "No grades recorded in this period.", fr: "Aucune note enregistrée sur cette période." },
  "reports.noAssessments": { en: "No assessments recorded in this period.", fr: "Aucune évaluation enregistrée sur cette période." },
  "reports.general": { en: "General", fr: "Général" },
  "reports.portfolioHighlights": { en: "Portfolio highlights", fr: "Temps forts du portfolio" },
  "reports.noPortfolio": { en: "No portfolio entries in this period.", fr: "Aucune entrée de portfolio sur cette période." },
  "reports.teacherComments": { en: "Teacher comments", fr: "Commentaires de l'enseignant(e)" },
  "reports.noComments": { en: "No comments added.", fr: "Aucun commentaire." },
  "reports.teacherSign": { en: "Teacher:", fr: "Enseignant(e) :" },
  "reports.dateSign": { en: "Date:", fr: "Date :" },
  "reports.fullHistory": { en: "Full history", fr: "Tout l'historique" },
  "reports.fromToPresent": { en: "{start} to present", fr: "du {start} à aujourd'hui" },
  "reports.upTo": { en: "up to {end}", fr: "jusqu'au {end}" },
  "reports.gpa": { en: "GPA", fr: "Moyenne" },
  "reports.gpaLine.one": { en: "{gpa} average across {n} grade", fr: "Moyenne de {gpa} sur {n} note" },
  "reports.gpaLine.other": { en: "{gpa} average across {n} grades", fr: "Moyenne de {gpa} sur {n} notes" },
  "reports.gpaNone": { en: "Not enough graded entries yet.", fr: "Pas encore assez de notes." },
  "reports.gradeHistory": { en: "Grade history", fr: "Historique des notes" },
  "reports.noGradeHistory": { en: "No grades recorded for this student yet.", fr: "Aucune note enregistrée pour cet élève pour l'instant." },
  "grade.meaning.A+": { en: "Outstanding", fr: "Exceptionnel" },
  "grade.meaning.A": { en: "Excellent", fr: "Excellent" },
  "grade.meaning.B+": { en: "Very Good", fr: "Très bien" },
  "grade.meaning.B": { en: "Good", fr: "Bien" },
  "grade.meaning.C+": { en: "Satisfactory", fr: "Satisfaisant" },
  "grade.meaning.C": { en: "Developing", fr: "En progression" },
  "grade.meaning.D": { en: "Needs improvement", fr: "À améliorer" },
  "grade.band.Exceeding Expectations": { en: "Exceeding Expectations", fr: "Dépasse les attentes" },
  "grade.band.Meeting Expectations": { en: "Meeting Expectations", fr: "Répond aux attentes" },
  "grade.band.Approaching Expectations": { en: "Approaching Expectations", fr: "Proche des attentes" },
  "grade.band.Below Expectations": { en: "Below Expectations", fr: "En dessous des attentes" },

  // Resources (parent view)
  "resources.count.one": { en: "{n} file shared", fr: "{n} document partagé" },
  "resources.count.other": { en: "{n} files shared", fr: "{n} documents partagés" },
  "resources.emptyParent": { en: "No shared documents yet.", fr: "Aucun document partagé pour l'instant." },
  "resourceCat.Policies": { en: "Policies", fr: "Règlements" },
  "resourceCat.Curriculum": { en: "Curriculum", fr: "Programme" },
  "resourceCat.Staff Resources": { en: "Staff Resources", fr: "Ressources du personnel" },
  "resourceCat.Professional Development": { en: "Professional Development", fr: "Formation continue" },
  "resourceCat.Forms & Templates": { en: "Forms & Templates", fr: "Formulaires et modèles" },
  "resourceCat.Parent Resources": { en: "Parent Resources", fr: "Ressources pour les parents" },

  // Family Updates (parent view)
  "updates.posts.one": { en: "{n} post", fr: "{n} publication" },
  "updates.posts.other": { en: "{n} posts", fr: "{n} publications" },

  // Portfolio (parent view)
  "portfolio.entries.one": { en: "{n} entry", fr: "{n} entrée" },
  "portfolio.entries.other": { en: "{n} entries", fr: "{n} entrées" },
  "portfolio.addedRecent": { en: "{n} added in the last 7 days", fr: "{n} ajoutée(s) au cours des 7 derniers jours" },
  "portfolio.emptyChild": { en: "No portfolio entries yet for your child.", fr: "Aucune entrée de portfolio pour votre enfant pour l'instant." },
  "portfolio.thisWeek": { en: "This week", fr: "Cette semaine" },
  "portfolio.earlier": { en: "Earlier", fr: "Plus tôt" },
  "portfolio.andMore": { en: " and {n} more", fr: " et {n} autre(s)" },

  // Attendance (parent view)
  "attendance.status.present": { en: "Present", fr: "Présent(e)" },
  "attendance.status.absent": { en: "Absent", fr: "Absent(e)" },
  "attendance.status.late": { en: "Late", fr: "En retard" },
  "attendance.status.excused": { en: "Excused", fr: "Absence justifiée" },
  "attendance.notMarked": { en: "Not marked yet", fr: "Pas encore renseigné" },
  "attendance.presentToday": { en: "present today", fr: "présent(s) aujourd'hui" },
  "attendance.jumpToday": { en: "Jump back to today", fr: "Revenir à aujourd'hui" },
  "attendance.weekend": { en: "No school on weekends. Attendance is only taken Monday to Friday.", fr: "Pas d'école le week-end. L'appel se fait uniquement du lundi au vendredi." },
  "attendance.jumpSchoolDay": { en: "Go to the last school day", fr: "Aller au dernier jour d'école" },
  "attendance.noRecord": { en: "No attendance recorded yet.", fr: "Aucune présence enregistrée pour l'instant." },

  // Assessment (parent view)
  "assessment.records.one": { en: "{n} record", fr: "{n} évaluation" },
  "assessment.records.other": { en: "{n} records", fr: "{n} évaluations" },
  "assessment.emptyChild": { en: "No assessment records yet for your child.", fr: "Aucune évaluation enregistrée pour votre enfant pour l'instant." },
  "assessment.standard": { en: "Standard:", fr: "Norme :" },
  "assessType.Baseline Assessment": { en: "Baseline Assessment", fr: "Évaluation diagnostique" },
  "assessType.Pre-Assessment": { en: "Pre-Assessment", fr: "Évaluation préalable" },
  "assessType.Formative": { en: "Formative", fr: "Évaluation formative" },
  "assessType.Summative (End of Unit)": { en: "Summative (End of Unit)", fr: "Évaluation sommative (fin d'unité)" },
  "assessType.MAP Test": { en: "MAP Test", fr: "Test MAP" },
  "assessType.End of Grade Test": { en: "End of Grade Test", fr: "Examen de fin d'année" },
  "assessType.Other": { en: "Other", fr: "Autre" },
  "level.Emerging": { en: "Emerging", fr: "En émergence" },
  "level.Developing": { en: "Developing", fr: "En développement" },
  "level.Proficient": { en: "Proficient", fr: "Maîtrisé" },
  "level.Confident": { en: "Confident", fr: "Assuré" },
  "level.Meeting": { en: "Meeting", fr: "Atteint" },
  "level.Exceeding": { en: "Exceeding", fr: "Dépassé" },

  // Assignments (parent view)
  "assignments.dueCount.one": { en: "{n} assignment due", fr: "{n} devoir à rendre" },
  "assignments.dueCount.other": { en: "{n} assignments due", fr: "{n} devoirs à rendre" },
  "assignments.dueHeading": { en: "Due", fr: "À rendre" },
  "assignments.pastDue": { en: "Past due", fr: "Échéance passée" },
  "assignments.empty": { en: "Nothing assigned yet.", fr: "Aucun devoir pour l'instant." },

  // "More" menu groups
  "menu.classroom": { en: "Classroom", fr: "Vie de classe" },
  "menu.office": { en: "School office", fr: "Vie scolaire" },
  "menu.compliance": { en: "Reports & compliance", fr: "Bulletins et documents" },

  // Settings, profile and password (parents see these)
  "settings.myProfile": { en: "My profile", fr: "Mon profil" },
  "settings.fullName": { en: "Full name", fr: "Nom complet" },
  "settings.phone": { en: "Phone number", fr: "Numéro de téléphone" },
  "settings.nationality": { en: "Nationality", fr: "Nationalité" },
  "settings.preferNotToSay": { en: "Prefer not to say", fr: "Je préfère ne pas répondre" },
  "settings.saveProfile": { en: "Save profile", fr: "Enregistrer le profil" },
  "settings.enterName": { en: "Please enter your name.", fr: "Veuillez saisir votre nom." },
  "settings.saveFailed": { en: "Could not save. Please try again.", fr: "Impossible d'enregistrer. Veuillez réessayer." },
  "settings.saved": { en: "Saved.", fr: "Enregistré." },
  "settings.newPassword": { en: "New password", fr: "Nouveau mot de passe" },
  "settings.passwordPlaceholder": { en: "At least 8 characters", fr: "Au moins 8 caractères" },
  "settings.confirmPassword": { en: "Confirm new password", fr: "Confirmer le nouveau mot de passe" },
  "settings.passwordTooShort": { en: "Password must be at least 8 characters.", fr: "Le mot de passe doit contenir au moins 8 caractères." },
  "settings.passwordMismatch": { en: "Passwords don't match.", fr: "Les mots de passe ne correspondent pas." },
  "settings.passwordFailed": { en: "Could not update password. Please try again.", fr: "Impossible de modifier le mot de passe. Veuillez réessayer." },
  "settings.passwordUpdated": { en: "Password updated.", fr: "Mot de passe modifié." },
  "settings.updating": { en: "Updating…", fr: "Mise à jour…" },
  "settings.updatePassword": { en: "Update password", fr: "Modifier le mot de passe" },

  // Settings modal, account section
  "settings.account": { en: "Account", fr: "Compte" },
  "settings.signedInAs": { en: "Signed in as", fr: "Connecté(e) en tant que" },
  "settings.signOut": { en: "Sign out", fr: "Se déconnecter" }
};

const LanguageContext = createContext({
  language: "en",
  canSwitch: false,
  setLanguage: () => {},
  t: (key, vars) => fill(translations[key]?.en || key, vars)
});

function fill(text, vars) {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (m, name) => (vars[name] !== undefined && vars[name] !== null ? String(vars[name]) : m));
}

// True when this key exists, so callers can fall back to the stored value
// (e.g. a custom category or event type the dictionary does not know).
export function hasTranslation(key) {
  return Object.prototype.hasOwnProperty.call(translations, key);
}

// Picks "key.one" or "key.other". French treats 0 and 1 as singular.
export function pluralKey(base, n, language) {
  const one = language === "fr" ? n <= 1 : n === 1;
  return `${base}.${one ? "one" : "other"}`;
}

export function useLanguage() {
  return useContext(LanguageContext);
}

// Only parents are allowed to switch languages. Every other role always sees English,
// regardless of what may be stored on the device.
export function LanguageProvider({ role, children }) {
  const canSwitch = role === "parent";
  const [language, setLanguageState] = useState("en");

  useEffect(() => {
    if (!canSwitch) {
      setLanguageState("en");
      return;
    }
    try {
      // A language picked on the login screen carries over after sign-in:
      // it wins when it was chosen just now, or when nothing is saved yet.
      const loginLang = window.localStorage.getItem("bsf-login-lang");
      const loginChoiceMade = window.localStorage.getItem("bsf-login-lang-chosen") === "1";
      const savedLang = window.localStorage.getItem("bsf-language");
      if ((loginLang === "en" || loginLang === "fr") && (loginChoiceMade || !savedLang)) {
        window.localStorage.setItem("bsf-language", loginLang);
      }
      window.localStorage.removeItem("bsf-login-lang-chosen");
      const stored = window.localStorage.getItem("bsf-language");
      if (stored === "en" || stored === "fr") {
        setLanguageState(stored);
      }
    } catch (e) {
      // localStorage unavailable, default to English
    }
  }, [canSwitch]);

  // Keep <html lang> in step so screen readers and the browser use the right language.
  useEffect(() => {
    try {
      document.documentElement.lang = language;
    } catch (e) {
      // ignore
    }
  }, [language]);

  const setLanguage = (lang) => {
    if (!canSwitch) return;
    setLanguageState(lang);
    try {
      window.localStorage.setItem("bsf-language", lang);
      window.localStorage.setItem("bsf-login-lang", lang);
    } catch (e) {
      // ignore
    }
  };

  // t("key") or t("key", { name: "Ada" }) to fill "{name}" placeholders.
  const t = (key, vars) => {
    const entry = translations[key];
    if (!entry) return key;
    return fill(entry[language] || entry.en || key, vars);
  };

  return (
    <LanguageContext.Provider value={{ language, canSwitch, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}
