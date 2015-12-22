//
//	NeutriumJS Steam
//	https://github.com/NativeDynamics/NeutriumJS.Steam
//
//	Copyright 2015, Native Dynamics
//	https://neutrium.net
//
//	Licensed under the Creative Commons Attribution 4.0 International
//	http://creativecommons.org/licenses/by/4.0/legalcode
//

(function (root, factory) {
    "use strict";

	if(typeof define === "function" && define.amd)
	{
		define('NeutriumJS/Steam/PH', ['NeutriumJS/Steam', 'NeutriumJS/Steam/PT'], factory);
	}
	else if (typeof exports === "object" && module.exports)
	{
		module.exports = factory(require('NeutriumJS.Steam'), require('NeutriumJS.Steam.PT'));
	}
	else
	{
		root.NeutriumJS = root.NeutriumJS || {};
		root.NeutriumJS.Steam = root.NeutriumJS.Steam || {};
		root.NeutriumJS.Steam.PH = factory(root.NeutriumJS.Steam, root.NeutriumJS.Steam.PT);
	}
}(this, function (NS, PT) {
	"use strict";

	// Private members
	var R = NS.CONST('R'),
		PH = {
			solve : solve,
			r2 : r2_PH,
			r1_PH_T : r1_PH_T,
			// Exposing equations for testing
			b2bc_H_P : b2bc_H_P,
			b2bc_P_H : b2bc_P_H,
			b3ab_P_H : b3ab_P_H,
			r3A_PH_V : r3A_PH_V,
			r3B_PH_V : r3B_PH_V,
			r4_H_Psat : r4_H_Psat,
		};

	return PH;

	//
	//	Comments : Calculate the steam properties using IAWPS for a given pressure and temperature
	//
	//	@param P is the pressure of the water in MPa
	//	@param h is the enthalpy kg/KJ.K
	//
	function solve(P, h)
	{
		var region = findRegion_PH(P,h),
			result = null;

		switch(region)
		{
			case 1  : result = r1_PH(P,h); break;
			case 2  : result = r2_PH(P,h); break;
			case 3  : result = r3_PH(P,h); break;
			case -1 : break;
		}

		return result;
	}

	//
	//	Comments : Determines which IAPWS-97 region a temperature and pressure combination lie in.
	//
	//	@param P is the pressure of the water in mega Pascals
	//	@param h is the enthalpy kg/KJ.K
	//
	function findRegion_PH(P, h)
	{
		var r = PT.r1(P, NS.CONST('MIN_T'));

		// Whats the region max/min for h
		if(P >= NS.CONST('MIN_P') && P <= NS.CONST('MAX_P') && h >= r.h )
		{
			if( P < NS.CONST('B23_MIN_P') )
			{
				var Ts = PT.r4_P_Tsat(P);

				r = PT.r1(P, Ts);

				if( h <= r.h )
				{
					return 1;
				}

				// Check region 2
				if( h < 4000)
				{
					return 2;
				}

				r = PT.r2(P, NS.CONST('R2_MAX_T'));

				if(h <= r.h)
				{
					return 2;
				}

				// Region 5
				if( P < NS.CONST('R5_MAX_P'))
				{
					r = PT.r5(P, NS.CONST('MAX_T'));

					if(h < r.h)
					{
						return 5;
					}
				}
			} else { // P >= B23_MIN_P
				// Region 1 check
				r = PT.r1(P, NS.CONST('R3_MIN_T'));

				if (h <= r.h)
				{
					return 1;
				}

				// Region 3
				r = PT.r2(P, PT.b23_P_T(P));

				if( h < r.h)
				{
					return 3;
				}

				// Region 2
				r = PT.r2(P, NS.CONST('R2_MAX_T'));

				if(h < r.h)
				{
					return 2;
				}
			}
		}

		return -1;
	}

	//
	//	Region 1
	//
	function r1_PH(P, h)
	{
		return PT.r1(P, r1_PH_T(P,h));
	}

	function r1_PH_T(P, h)
	{
		var R1_PH_I = [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 2, 2, 3, 3, 4, 5, 6],
			R1_PH_J = [0, 1, 2, 6, 22, 32, 0, 1, 2, 3, 4, 10, 32, 10, 32, 10, 32, 32, 32, 32],
			R1_PH_N = [-238.72489924521, 404.21188637945, 113.49746881718, -5.8457616048039, -0.0001528548241314, -1.0866707695377E-6, -13.391744872602, 43.211039183559, -54.010067170506, 30.535892203916, -6.5964749423638, 0.0093965400878363, 1.157364750534E-7, -0.000025858641282073, -4.0644363084799E-9, 6.6456186191635E-8, 8.0670734103027E-11, -9.3477771213947E-13, 5.8265442020601E-15, -1.5020185953503E-17],
			pi = P,
			m = h/2500,
			T = 0;

		for(var i = 0; i < 20; i++)
		{
			var N = R1_PH_N[i],
				I = R1_PH_I[i],
				J = R1_PH_J[i];

			T += N*Math.pow(pi,I)*Math.pow((m+1), J);
		}

		return T;
	}

	//
	//	Region 2
	//
	function r2_PH(P, h)
	{
		var T = r2_PH_T(P,h);

		return PT.r2(P, T);
	}

	function r2_PH_T(P, h)
	{
		var T;

		if(P < NS.CONST('R2_CRT_P'))
		{
			T = r2A_PH_T(P, h);
		}
		else
		{
			if(P < b2bc_H_P(h))
			{
				T = r2B_PH_T(P,h);
			}
			else
			{
				T = r2C_PH_T(P,h);
			}
		}

		return T;
	}

	//
	//	Equation 20 (page 21)
	//	From : Release on the IAPWS Industrial Formulation 1997 for the Thermodynamic Properties of Water
	//		   and Steam, September 1997
	//  Simple quadratic pressure-entalphy relationship for the region 2b - 2c boundary
	//
	function b2bc_H_P(h)
	{
		return 0.90584278514723E3 - 0.67955786399241*h + 0.12809002730136E-3*h*h;
	}

	function b2bc_P_H(P)
	{
		return (2652.6571908428 + Math.pow((P-4.5257578905948)/0.00012809002730136,0.5));
	}

	// Equation 22
	function r2A_PH_T(P, h)
	{
		var R2A_I = [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 7],
			R2A_J = [0, 1, 2, 3, 7, 20, 0, 1, 2, 3, 7, 9, 11, 18, 44, 0, 2, 7, 36, 38, 40, 42, 44, 24, 44, 12, 32, 44, 32, 36, 42, 34, 44, 28],
			R2A_N = [1089.8952318288, 849.51654495535, -107.81748091826, 33.153654801263, -7.4232016790248, 11.765048724356, 1.844574935579, -4.1792700549624, 6.2478196935812, -17.344563108114, -200.58176862096, 271.96065473796, -455.11318285818, 3091.9688604755, 252266.40357872, -0.0061707422868339, -0.31078046629583, 11.670873077107, 128127984.04046, -985549096.23276, 2822454697.3002, -3594897141.0703, 1722734991.3197, -13551.334240775, 12848734.66465, 1.3865724283226, 235988.32556514, -13105236.545054, 7399.9835474766, -551966.9703006, 3715408.5996233, 19127.7292396, -415351.64835634, -62.459855192507],
			pi = P,
			m = h/2000,
			T = 0;

		for(var i = 0; i < 34; i++)
		{
			var N = R2A_N[i],
				I = R2A_I[i],
				J = R2A_J[i];

			T += N*Math.pow(pi,I)*Math.pow(m-2.1, J);
		}

		return T;
	}

	function r2B_PH_T(P, h)
	{
		var R2B_PH_I = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 6, 7, 7, 9, 9],
			R2B_PH_J = [0, 1, 2, 12, 18, 24, 28, 40, 0, 2, 6, 12, 18, 24, 28, 40, 2, 8, 18, 40, 1, 2, 12, 24, 2, 12, 18, 24, 28, 40, 18, 24, 40, 28, 2, 28, 1, 40],
			R2B_PH_N = [1489.5041079516, 743.07798314034, -97.708318797837, 2.4742464705674, -0.63281320016026, 1.1385952129658, -0.47811863648625, 0.0085208123431544, 0.93747147377932, 3.3593118604916, 3.3809355601454, 0.16844539671904, 0.73875745236695, -0.47128737436186, 0.15020273139707, -0.002176411421975, -0.021810755324761, -0.10829784403677, -0.046333324635812, 0.000071280351959551, 0.00011032831789999, 0.00018955248387902, 0.0030891541160537, 0.0013555504554949, 2.8640237477456E-7, -0.000010779857357512, -0.000076462712454814, 0.000014052392818316, -0.000031083814331434, -1.0302738212103E-6, 2.821728163504E-7, 1.2704902271945E-6, 7.3803353468292E-8, -1.1030139238909E-8, -8.1456365207833E-14, -2.5180545682962E-11, -1.7565233969407E-18, 8.6934156344163E-15],
			pi = P,
			m = h/2000,
			T = 0;

		for(var i = 0; i < 38; i++)
		{
			var N = R2B_PH_N[i],
				I = R2B_PH_I[i],
				J = R2B_PH_J[i];

			T += N*Math.pow((pi-2), I)*Math.pow((m-2.6), J);
		}

		return T;
	}

	// Equation 24
	function r2C_PH_T(P, h)
	{
		var R2C_PH_I = [-7, -7, -6, -6, -5, -5, -2, -2, -1, -1, 0, 0, 1, 1, 2, 6, 6, 6, 6, 6, 6, 6, 6],
			R2C_PH_J = [0, 4, 0, 2, 0, 2, 0, 1, 0, 2, 0, 1, 4, 8, 4, 0, 1, 4, 10, 12, 16, 20, 22],
			R2C_PH_N = [-3236839855524.2, 7326335090218.1, 358250899454.47, -583401318515.9, -10783068217.47, 20825544563.171, 610747.83564516, 859777.2253558, -25745.72360417, 31081.088422714, 1208.2315865936, 482.19755109255, 3.7966001272486, -10.842984880077, -0.04536417267666, 1.4559115658698E-13, 1.126159740723E-12, -1.7804982240686E-11, 1.2324579690832E-7, -1.1606921130984E-6, 0.000027846367088554, -0.00059270038474176, 0.0012918582991878],
			pi = P,
			m = h/2000,
			T = 0;

		for(var i = 0; i < 23; i++)
		{
			var N = R2C_PH_N[i],
				I = R2C_PH_I[i],
				J = R2C_PH_J[i];

			T += N*Math.pow(pi+25, I)*Math.pow(m-1.8, J);
		}

		return T;
	}

	//
	//	Region 3
	//
	function r3_PH(P, h)
	{
		var T,
			rho;

		if( h < b3ab_P_H(P) )
		{
			T = r3A_PH_T(P,h);
			rho = r3A_PH_V(P,h);
		}
		else
		{
			T = r3B_PH_T(P,h);
			rho = r3B_PH_V(P,h);
		}

		return PT.r3(P, T, rho);
	}

	//
	//	Equation 1 (page 5)
	//	From : Revised Supplementary Release on Backward Equations for the Functions
	//  		T(p,h), v(p,h) and T(p,s), v(p,s) for Region 3 of the IAPWS Industrial
	//  		Formulation 1997 for the Thermodynamic Properties of Water and Steam
	//  Polynomial to match the critical isentropic line (but does not match exactly)
	//
	function b3ab_P_H(P)
	{
		return 2014.64004206875 + 3.74696550136983*P + -0.0219921901054187*P*P + 0.000087513168600995*P*P*P;
	}

	function r3A_PH_T(P, h)
	{
		var R3A_PH_I = [-12, -12, -12, -12, -12, -12, -12, -12, -10, -10, -10, -8, -8, -8, -8, -5, -3, -2, -2, -2, -1, -1, 0, 0, 1, 3, 3, 4, 4, 10, 12],
			R3A_PH_J = [0, 1, 2, 6, 14, 16, 20, 22, 1, 5, 12, 0, 2, 4, 10, 2, 0, 1, 3, 4, 0, 2, 0, 1, 1, 0, 1, 0, 3, 4, 5],
			R3A_PH_N = [-1.33645667811215E-7, 4.55912656802978E-6, -1.46294640700979E-5, 0.0063934131297008, 372.783927268847, -7186.54377460447, 573494.7521034, -2675693.29111439, -3.34066283302614E-5, -0.0245479214069597, 47.8087847764996, 7.64664131818904E-6, 0.00128350627676972, 0.0171219081377331, -8.51007304583213, -0.0136513461629781, -3.84460997596657E-6, 0.00337423807911655, -0.551624873066791, 0.72920227710747, -0.00992522757376041, -0.119308831407288, 0.793929190615421, 0.454270731799386, 0.20999859125991, -0.00642109823904738, -0.023515586860454, 0.00252233108341612, -0.00764885133368119, 0.0136176427574291, -0.0133027883575669],
			pi = P/100,
			m = h/2300,
			T = 0;

		for(var i = 0; i < 31; i++)
		{
			var N = R3A_PH_N[i],
				I = R3A_PH_I[i],
				J = R3A_PH_J[i];

			T += N*Math.pow((pi+0.240),I)*Math.pow((m-0.615),J);
		}

		return 760*T;
	}

	function r3A_PH_V(P, h)
	{
		var R3A_PH_v_I = [-12, -12, -12, -12, -10, -10, -10, -8, -8, -6, -6, -6, -4, -4, -3, -2, -2, -1, -1, -1, -1, 0, 0, 1, 1, 1, 2, 2, 3, 4, 5, 8],
			R3A_PH_v_J = [6, 8, 12, 18, 4, 7, 10, 5, 12, 3, 4, 22, 2, 3, 7, 3, 16, 0, 1, 2, 3, 0, 1, 0, 1, 2, 0, 2, 0, 2, 2, 2],
			R3A_PH_v_N = [0.00529944062966028, -0.170099690234461, 11.1323814312927, -2178.98123145125, -0.000506061827980875, 0.556495239685324, -9.43672726094016, -0.297856807561527, 93.9353943717186, 0.0192944939465981, 0.421740664704763, -3689141.2628233, -0.00737566847600639, -0.354753242424366, -1.99768169338727, 1.15456297059049, 5683.6687581596, 0.00808169540124668, 0.172416341519307, 1.04270175292927, -0.297691372792847, 0.560394465163593, 0.275234661176914, -0.148347894866012, -0.0651142513478515, -2.92468715386302, 0.0664876096952665, 3.52335014263844, -0.0146340792313332, -2.24503486668184, 1.10533464706142, -0.0408757344495612],
			pi = P/100,
			m = h/2100,
			v = 0;

		for(var i = 0; i < 32; i++)
		{
			var N = R3A_PH_v_N[i],
				I = R3A_PH_v_I[i],
				J = R3A_PH_v_J[i];

			v += N*Math.pow((pi+0.128),I)*Math.pow((m-0.727),J);
		}

		return 0.0028*v;
	}

	function r3B_PH_T(P, h)
	{
		var R3B_PH_I = [-12, -12, -10, -10, -10, -10, -10, -8, -8, -8, -8, -8, -6, -6, -6, -4, -4, -3, -2, -2, -1, -1, -1, -1, -1, -1, 0, 0, 1, 3, 5, 6, 8],
			R3B_PH_J = [0, 1, 0, 1, 5, 10, 12, 0, 1, 2, 4, 10, 0, 1, 2, 0, 1, 5, 0, 4, 2, 4, 6, 10, 14, 16, 0, 2, 1, 1, 1, 1, 1, ],
			R3B_PH_N = [0.000032325457364492, -0.000127575556587181, -0.000475851877356068, 0.00156183014181602, 0.105724860113781, -85.8514221132534, 724.140095480911, 0.00296475810273257, -0.00592721983365988, -0.0126305422818666, -0.115716196364853, 84.9000969739595, -0.0108602260086615, 0.0154304475328851, 0.0750455441524466, 0.0252520973612982, -0.0602507901232996, -3.07622221350501, -0.0574011959864879, 5.03471360939849, -0.925081888584834, 3.91733882917546, -77.314600713019, 9493.08762098587, -1410437.19679409, 8491662.30819026, 0.861095729446704, 0.32334644281172, 0.873281936020439, -0.436653048526683, 0.286596714529479, -0.131778331276228, 0.00676682064330275],
			pi = P/100,
			m = h/2800,
			T = 0;

		for(var i = 0; i < 33; i++)
		{
			var N = R3B_PH_N[i],
				I = R3B_PH_I[i],
				J = R3B_PH_J[i];

			T += N*Math.pow((pi+0.298),I)*Math.pow((m-0.720),J);
		}

		return 860*T;
	}

	function r3B_PH_V(P, h)
	{
		var R3B_PH_v_I = [-12, -12, -8, -8, -8, -8, -8, -8, -6, -6, -6, -6, -6, -6, -4, -4, -4, -3, -3, -2, -2, -1, -1, -1, -1, 0, 1, 1, 2, 2],
			R3B_PH_v_J = [0, 1, 0, 1, 3, 6, 7, 8, 0, 1, 2, 5, 6, 10, 3, 6, 10, 0, 2, 1, 2, 0, 1, 4, 5, 0, 0, 1, 2, 6],
			R3B_PH_v_N = [-2.25196934336318E-09, 1.40674363313486E-08, 2.3378408528056E-06, -3.31833715229001E-05, 0.00107956778514318, -0.271382067378863, 1.07202262490333, -0.853821329075382, -2.15214194340526E-05, 0.00076965608822273, -0.00431136580433864, 0.453342167309331, -0.507749535873652, -100.475154528389, -0.219201924648793, -3.21087965668917, 607.567815637771, 0.000557686450685932, 0.18749904002955, 0.00905368030448107, 0.285417173048685, 0.0329924030996098, 0.239897419685483, 4.82754995951394, -11.8035753702231, 0.169490044091791, -0.0179967222507787, 0.0371810116332674, -0.0536288335065096, 1.6069710109252],
			pi = P/100,
			m = h/2800,
			v = 0;

		for(var i = 0; i < 30; i++)
		{
			var N = R3B_PH_v_N[i],
				I = R3B_PH_v_I[i],
				J = R3B_PH_v_J[i];

			v += N*Math.pow(pi + 0.0661,I)*Math.pow(m - 0.720,J);
		}

		return 0.0088*v;
	}

	//
	// Region 4
	//
	function r4_H_Psat(h)
	{
		var R4_I = [0, 1, 1, 1, 1, 5, 7, 8, 14, 20, 22, 24 ,28, 36],
			R4_J = [0, 1, 3, 4, 36, 3, 0, 24, 16, 16, 3, 18, 8, 24],
			R4_N = [0.600073641753024, -9.36203654849857, 2.46590798594147E1, -1.07014222858224E2, -9.15821315805768E13, -8.62332011700662E3, -2.35837344740032E1, 2.52304969384128E17, -3.89718771997719E18, -3.33775713645296E22, 3.56499469636328E10, -1.48547544720641E26, 3.30611514838798E18, 8.13641294467829E37],
			mu = h/2600,
			p = 0;

		for(var i = 0; i < 14; i++)
		{
			var N = R4_N[i],
				I = R4_I[i],
				J = R4_J[i];

			p += N*Math.pow(mu - 1.02, I)*Math.pow(mu - 0.608, J);
		}

		return 22*p;
	}

}));
